/**
 * E2E da PONTE do Serviço Social (sinalizações dos profissionais).
 * Uso: SENHA_ADMIN=... SENHA_DEV=... node scripts/valida-ponte.mjs
 *   SENHA_ADMIN = SEED_SUPER_ADMIN_PASSWORD (admin@ifp.local — consome a ponte)
 *   SENHA_DEV   = SEED_MEDICO_PASSWORD (medico@ifp.local — profissional que sinaliza)
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

const fr = await req(medico, "GET", "/medico/fichas?q=joao");
const fichaId = (fr.json?.items ?? [])[0]?.id;
if (!fichaId) {
  console.error("Nenhuma ficha encontrada — rode o seed.");
  process.exit(2);
}

// Estado limpo: o seed deixa o João com sinalização medico/ALERTA PENDENTE e
// este script cria mais de uma; com o índice único parcial (ficha+origem+tipo)
// recriar daria 409. Drena (marca-atendida) antes — torna o script re-executável.
const pend = await req(admin, "GET", "/servico-social/ponte?status=PENDENTE&perPage=100");
for (const s of pend.json?.items ?? []) {
  if (s.fichaId !== fichaId) continue;
  await req(admin, "PATCH", `/servico-social/ponte/${s.id}/marcar-atendida`);
}

console.log("--- CRIAR (profissional sinaliza) ---");
const criar = await req(medico, "POST", "/servico-social/ponte", {
  fichaId,
  unidadeOrigemSlug: "medico",
  tipo: "ALERTA",
  prioridade: "URGENTE",
  descricao: "QA sinalização da ponte",
});
caso("médico cria → 201", 201, criar.status);
caso("nasce PENDENTE", "PENDENTE", criar.json?.status);
caso("origem = unidade do profissional (não a do corpo)", "medico", criar.json?.unidadeOrigem?.slug);
const sinalId = criar.json?.id;

// Anti-forja (P1 da auditoria rodada 2): o profissional tenta carimbar OUTRA
// unidade como origem — o servidor IGNORA o corpo e usa a unidade real do cadastro.
const forja = await req(medico, "POST", "/servico-social/ponte", {
  fichaId,
  unidadeOrigemSlug: "esportivo",
  descricao: "QA tentativa de forjar a origem",
});
caso("forja: POST aceito → 201", 201, forja.status);
caso("forja: origem ignorada (continua medico)", "medico", forja.json?.unidadeOrigem?.slug);

const membroInvalido = await req(medico, "POST", "/servico-social/ponte", {
  fichaId,
  membroId: "membro-inexistente",
  unidadeOrigemSlug: "medico",
  descricao: "QA membro inválido",
});
caso("membro fora da ficha → 400", 400, membroInvalido.status);

// Payload EXATO que a UI envia (botão "Sinalizar ao Social" das verticais):
// só fichaId + descricao + tipo + prioridade, SEM unidadeOrigemSlug (origem é
// server-authoritative). tipo OBSERVACAO p/ não colidir com o ALERTA/ENCAMINHAMENTO
// já criados acima (índice único parcial por ficha+origem+tipo).
const uiPayload = await req(medico, "POST", "/servico-social/ponte", {
  fichaId,
  tipo: "OBSERVACAO",
  prioridade: "NORMAL",
  descricao: "QA payload da UI (Sinalizar ao Social)",
});
caso("UI: POST sem unidadeOrigemSlug → 201", 201, uiPayload.status);
caso("UI: nasce PENDENTE", "PENDENTE", uiPayload.json?.status);
caso("UI: origem = unidade do profissional", "medico", uiPayload.json?.unidadeOrigem?.slug);

console.log("--- CONSUMO (social) ---");
const lista = await req(admin, "GET", "/servico-social/ponte?status=PENDENTE");
caso("lista → 200", 200, lista.status);
caso("tem KPI pendentes", true, typeof lista.json?.kpis?.pendentes === "number");
caso("a sinalização aparece", true, (lista.json?.items ?? []).some((s) => s.id === sinalId));

console.log("--- ATENDER + idempotência ---");
const atender = await req(admin, "PATCH", `/servico-social/ponte/${sinalId}/marcar-atendida`);
caso("atende → ATENDIDA", "ATENDIDA", atender.json?.status);
const atenderDup = await req(admin, "PATCH", `/servico-social/ponte/${sinalId}/marcar-atendida`);
caso("atender de novo → 409", 409, atenderDup.status);

console.log("--- RBAC ---");
// Profissional NÃO consome a fila do social (só sinaliza).
const consumoProf = await req(medico, "GET", "/servico-social/ponte");
caso("médico consome ponte → 403", 403, consumoProf.status);

const total = resultados.length;
const ok = resultados.filter(Boolean).length;
console.log(`\n${ok}/${total}`);
if (ok !== total) process.exit(1);
console.log(">>> PONTE (Serviço Social) VALIDADA <<<");
