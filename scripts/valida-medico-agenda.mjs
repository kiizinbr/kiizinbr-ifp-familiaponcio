/**
 * E2E da gestão de agendamento do Centro Médico (Bloco C): confirmar, marcar
 * falta, reagendar, cancelar, e o bloqueio de alterar um atendimento já iniciado.
 * Uso: SENHA_DEV=... node scripts/valida-medico-agenda.mjs
 * Pré: seed rodado (usa um paciente já elegível no médico).
 */
const API = process.env.API_URL_TESTE ?? "http://127.0.0.1:3333/api/v1";
const SENHA = process.env.SENHA_DEV;
if (!SENHA) {
  console.error("Defina SENHA_DEV");
  process.exit(2);
}

async function login(email) {
  const r = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, senha: SENHA }),
  });
  if (!r.ok) throw new Error(`login ${email}: ${r.status}`);
  return (await r.json()).accessToken;
}

async function req(token, method, path, body) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await r.json();
  } catch {
    /* sem corpo */
  }
  return { status: r.status, json };
}

const resultados = [];
function caso(nome, esperado, obtido) {
  const ok = esperado === obtido;
  resultados.push(ok);
  console.log(`${ok ? "✓" : "✗ FALHOU"} ${nome}: ${obtido} (espera ${esperado})`);
}

const medico = await login("medico@ifp.local");
const familia = await login("familia@ifp.local");
const emHoras = (h) => new Date(Date.now() + h * 3600_000).toISOString();

// Acha um paciente elegível no médico.
let fichaId = null;
for (const termo of ["silva", "oliveira", "santos", "an"]) {
  const r = await req(medico, "GET", `/medico/fichas?q=${termo}`);
  if (r.json?.items?.length) {
    fichaId = r.json.items[0].id;
    break;
  }
}
if (!fichaId) {
  console.error("Nenhum paciente elegível encontrado — rode o seed.");
  process.exit(2);
}

console.log("--- CRIAÇÃO ---");
const ag = await req(medico, "POST", "/medico/agendamentos", {
  fichaId,
  inicioEm: emHoras(1),
  motivo: "QA agenda",
});
caso("cria agendamento", 201, ag.status);
const agId = ag.json?.id;
caso("nasce CONFIRMADO", "CONFIRMADO", ag.json?.status);

console.log("--- GESTÃO (falta / reagendar / cancelar) ---");
const falta = await req(medico, "PATCH", `/medico/agendamentos/${agId}`, { status: "FALTOU" });
caso("marca falta", 200, falta.status);
caso("status vira FALTOU", "FALTOU", falta.json?.status);

const reag = await req(medico, "PATCH", `/medico/agendamentos/${agId}`, {
  inicioEm: emHoras(2),
  status: "CONFIRMADO",
});
caso("reagenda + reconfirma", 200, reag.status);
caso("status volta CONFIRMADO", "CONFIRMADO", reag.json?.status);

const invalido = await req(medico, "PATCH", `/medico/agendamentos/${agId}`, {
  status: "EM_ATENDIMENTO",
});
caso("status não-gerenciável barrado (400)", 400, invalido.status);

const canc = await req(medico, "PATCH", `/medico/agendamentos/${agId}`, { status: "CANCELADO" });
caso("cancela agendamento", 200, canc.status);
caso("status vira CANCELADO", "CANCELADO", canc.json?.status);

console.log("--- BLOQUEIO PÓS-INÍCIO ---");
const ag2 = await req(medico, "POST", "/medico/agendamentos", {
  fichaId,
  inicioEm: emHoras(3),
});
const ini = await req(medico, "POST", `/medico/agendamentos/${ag2.json?.id}/iniciar`);
caso("inicia atendimento", 201, ini.status);
const alterIniciado = await req(medico, "PATCH", `/medico/agendamentos/${ag2.json?.id}`, {
  status: "CANCELADO",
});
caso("não altera agendamento já iniciado (400)", 400, alterIniciado.status);

console.log("--- RBAC ---");
const fam = await req(familia, "PATCH", `/medico/agendamentos/${agId}`, { status: "CONFIRMADO" });
caso("família não altera agendamento (RBAC)", 403, fam.status);

const total = resultados.length;
const ok = resultados.filter(Boolean).length;
console.log(`\n${ok}/${total}`);
if (ok !== total) process.exit(1);
console.log(">>> GESTÃO DE AGENDA MÉDICA VALIDADA <<<");
