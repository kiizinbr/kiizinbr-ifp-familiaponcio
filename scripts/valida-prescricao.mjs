/**
 * E2E da PRESCRIÇÃO médica com BLOQUEIO de alergia server-side.
 * Uso: SENHA_DEV=... node scripts/valida-prescricao.mjs
 * Pré: seed rodado — João da Silva tem alergia ATIVA a "Dipirona".
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
  console.log(`${ok ? "✓" : "✗ FALHOU"} ${nome}: ${JSON.stringify(obtido)} (espera ${JSON.stringify(esperado)})`);
}

const medico = await login("medico@ifp.local");
const familia = await login("familia@ifp.local");
const emHoras = (h) => new Date(Date.now() + h * 3600_000).toISOString();

// Acha o João da Silva (paciente com alergia a Dipirona no seed).
let fichaId = null;
for (const termo of ["joao", "joão", "silva"]) {
  const r = await req(medico, "GET", `/medico/fichas?q=${encodeURIComponent(termo)}`);
  const itens = r.json?.items ?? [];
  const item =
    itens.find((f) => /jo[aã]o/i.test(f.nomeCompleto ?? f.nome ?? "")) ??
    (termo.startsWith("jo") ? itens[0] : null);
  if (item) {
    fichaId = item.id;
    break;
  }
}
if (!fichaId) {
  console.error("João não encontrado — rode o seed.");
  process.exit(2);
}

// Cria agendamento e inicia o atendimento (titular João).
const ag = await req(medico, "POST", "/medico/agendamentos", {
  fichaId,
  inicioEm: emHoras(1),
  motivo: "QA prescricao",
});
if (ag.status !== 201) {
  console.error("falha ao criar agendamento", ag.status, ag.json);
  process.exit(2);
}
const ini = await req(medico, "POST", `/medico/agendamentos/${ag.json.id}/iniciar`);
const atId = ini.json?.id;
caso("inicia atendimento (tem id)", true, !!atId);

const LIMPO = { itens: [{ medicamento: "Amoxicilina 500mg", posologia: "1 cp 8/8h por 7 dias" }] };
const DIPIRONA = { itens: [{ medicamento: "Dipirona 500mg", posologia: "1 cp se dor" }] };

console.log("--- PRESCRIÇÃO LIMPA ---");
const limpo = await req(medico, "POST", `/medico/atendimentos/${atId}/prescricoes`, LIMPO);
caso("prescrição sem conflito → 201", 201, limpo.status);
caso("não marca override", false, limpo.json?.alergiaOverride);
caso("item sem conflito", false, limpo.json?.itens?.[0]?.conflitoAlergia);

console.log("--- VALIDAÇÃO ---");
const vazio = await req(medico, "POST", `/medico/atendimentos/${atId}/prescricoes`, { itens: [] });
caso("itens vazio → 400", 400, vazio.status);

console.log("--- BLOQUEIO DE ALERGIA (server-side) ---");
const bloq = await req(medico, "POST", `/medico/atendimentos/${atId}/prescricoes`, DIPIRONA);
caso("Dipirona SEM override → 409", 409, bloq.status);
caso("código ALERGIA_CONFLITO", "ALERGIA_CONFLITO", bloq.json?.code);
caso("lista de conflitos não-vazia", true, (bloq.json?.conflitos?.length ?? 0) > 0);

console.log("--- OVERRIDE CONSCIENTE ---");
const ovr = await req(medico, "POST", `/medico/atendimentos/${atId}/prescricoes`, {
  ...DIPIRONA,
  override: { motivo: "Paciente ja usou sem reacao; beneficio supera o risco." },
});
caso("Dipirona COM override → 201", 201, ovr.status);
caso("marca alergiaOverride", true, ovr.json?.alergiaOverride);
caso("registra motivo", true, !!ovr.json?.alergiaOverrideMotivo);
caso("item marcado conflitoAlergia", true, ovr.json?.itens?.[0]?.conflitoAlergia);

console.log("--- NOT FOUND ---");
const nf = await req(medico, "POST", `/medico/atendimentos/atendimento-inexistente/prescricoes`, LIMPO);
caso("atendimento inexistente → 404", 404, nf.status);

console.log("--- RBAC ---");
const fam = await req(familia, "POST", `/medico/atendimentos/${atId}/prescricoes`, LIMPO);
caso("família não prescreve → 403", 403, fam.status);

console.log("--- ATENDIMENTO SELADO (imutável) ---");
await req(medico, "PATCH", `/medico/atendimentos/${atId}`, {
  subjetivo: "Cefaleia",
  plano: "Sintomaticos",
});
const sel = await req(medico, "POST", `/medico/atendimentos/${atId}/encerrar`);
caso("sela atendimento", 200, sel.status);
const posSelo = await req(medico, "POST", `/medico/atendimentos/${atId}/prescricoes`, LIMPO);
caso("prescrever em atendimento selado → 409", 409, posSelo.status);

const total = resultados.length;
const ok = resultados.filter(Boolean).length;
console.log(`\n${ok}/${total}`);
if (ok !== total) process.exit(1);
console.log(">>> PRESCRIÇÃO + BLOQUEIO DE ALERGIA VALIDADO <<<");
