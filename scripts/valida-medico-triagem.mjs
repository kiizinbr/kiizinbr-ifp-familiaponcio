/**
 * E2E da TRIAGEM DE ENFERMAGEM do Centro Médico (acolhimento na chegada):
 * recepção marca chegada → enfermagem registra vitais + classificação de risco
 * → médico lê a triagem na abertura da prancha. DADO CLÍNICO (RBAC + auditoria).
 *
 * Uso: SENHA_ADMIN=... SENHA_DEV=... node scripts/valida-medico-triagem.mjs
 *   SENHA_ADMIN = SEED_SUPER_ADMIN_PASSWORD (admin@ifp.local — balcão p/ chegada)
 *   SENHA_DEV   = SEED_MEDICO_PASSWORD (medico@ifp.local — Profissional MÉDICO,
 *                 faz o papel de enfermagem/triador e também lê a prancha)
 * Pré: seed rodado.
 */
const API = process.env.API_URL_TESTE ?? "http://127.0.0.1:3333/api/v1";
const SENHA_ADMIN = process.env.SENHA_ADMIN;
const SENHA_MEDICO = process.env.SENHA_DEV;
if (!SENHA_ADMIN || !SENHA_MEDICO) {
  console.error("Defina SENHA_ADMIN e SENHA_DEV");
  process.exit(2);
}

async function login(email, senha) {
  const r = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, senha }),
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

const admin = await login("admin@ifp.local", SENHA_ADMIN);
const medico = await login("medico@ifp.local", SENHA_MEDICO);
const familia = await login("familia@ifp.local", SENHA_MEDICO).catch(() => null);
// família usa a própria senha de seed (igual à do médico no ambiente de teste);
// se não logar, os casos de RBAC de família são pulados graciosamente.

console.log("--- SETUP (ficha + agendamento) ---");
let fichaId = null;
for (const t of ["silva", "oliveira", "santos", "joao"]) {
  const r = await req(medico, "GET", `/medico/fichas?q=${t}`);
  if (r.json?.items?.length) {
    fichaId = r.json.items[0].id;
    break;
  }
}
if (!fichaId) {
  console.error("Nenhuma ficha elegível encontrada — rode o seed.");
  process.exit(2);
}

const novoAg = await req(medico, "POST", "/medico/agendamentos", {
  fichaId,
  inicioEm: new Date(Date.now() + 3600_000).toISOString(),
  motivo: "QA triagem enfermagem",
});
caso("médico cria agendamento", 201, novoAg.status);
const agId = novoAg.json?.id;

console.log("--- TRIAR ANTES DE CHEGAR (bloqueio) ---");
const semChegada = await req(medico, "PUT", `/medico/agendamentos/${agId}/triagem-enfermagem`, {
  classificacaoRisco: "VERDE",
  pressaoSistolica: 120,
  pressaoDiastolica: 80,
});
caso("triar sem chegada marcada → 400", 400, semChegada.status);

console.log("--- CHEGADA + TRIAGEM ---");
const chegada = await req(admin, "POST", `/medico/agendamentos/${agId}/chegada`);
caso("admin (balcão) marca chegada", 201, chegada.status);

const triar = await req(medico, "PUT", `/medico/agendamentos/${agId}/triagem-enfermagem`, {
  classificacaoRisco: "AMARELO",
  pressaoSistolica: 140,
  pressaoDiastolica: 90,
  frequenciaCardiaca: 88,
  temperaturaC: 37.8,
  saturacaoO2: 96,
  dorEscala: 6,
  queixaPrincipal: "Cefaleia há 2 dias",
  observacoes: "Paciente refere piora à noite.",
});
caso("enfermagem registra triagem → 200", 200, triar.status);
caso("classificação de risco gravada", "AMARELO", triar.json?.classificacaoRisco);
caso("vital gravado (PA sist.)", 140, triar.json?.pressaoSistolica);
caso("escala de dor gravada", 6, triar.json?.dorEscala);

console.log("--- REGISTRAR DE NOVO (upsert / substituição) ---");
const retriar = await req(medico, "PUT", `/medico/agendamentos/${agId}/triagem-enfermagem`, {
  classificacaoRisco: "VERMELHO",
  pressaoSistolica: 180,
  pressaoDiastolica: 110,
});
caso("retriar → 200 (upsert)", 200, retriar.status);
caso("risco atualizado", "VERMELHO", retriar.json?.classificacaoRisco);
caso("campo omitido virou null (FC)", null, retriar.json?.frequenciaCardiaca);

console.log("--- MÉDICO LÊ A TRIAGEM ---");
const lerTriagem = await req(medico, "GET", `/medico/agendamentos/${agId}/triagem-enfermagem`);
caso("médico lê a triagem → 200", 200, lerTriagem.status);
caso("traz a classificação de risco", "VERMELHO", lerTriagem.json?.classificacaoRisco);

// e a prancha (abertura do atendimento) traz a triagem embutida
const prancha = await req(medico, "GET", `/medico/agenda/${agId}`);
caso("prancha → 200", 200, prancha.status);
caso("prancha embute a triagem de enfermagem", "VERMELHO", prancha.json?.triagem?.classificacaoRisco);

console.log("--- VALIDAÇÃO / RBAC ---");
const triagemInexistente = await req(medico, "GET", "/medico/agendamentos/ag-inexistente/triagem-enfermagem");
caso("agendamento inexistente → 404", 404, triagemInexistente.status);
const riscoInvalido = await req(medico, "PUT", `/medico/agendamentos/${agId}/triagem-enfermagem`, {
  classificacaoRisco: "ROXO",
});
caso("classificação de risco inválida → 400", 400, riscoInvalido.status);

if (familia) {
  const famTriar = await req(familia, "PUT", `/medico/agendamentos/${agId}/triagem-enfermagem`, {
    classificacaoRisco: "VERDE",
  });
  caso("família não triagem (RBAC)", 403, famTriar.status);
  const famLer = await req(familia, "GET", `/medico/agendamentos/${agId}/triagem-enfermagem`);
  caso("família não lê triagem (RBAC)", 403, famLer.status);
} else {
  console.log("(família não logou — casos de RBAC de família pulados)");
}

const total = resultados.length;
const ok = resultados.filter(Boolean).length;
console.log(`\n${ok}/${total}`);
if (ok !== total) process.exit(1);
console.log(">>> TRIAGEM DE ENFERMAGEM (Centro Médico) VALIDADA <<<");
