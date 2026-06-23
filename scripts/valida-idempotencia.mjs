/**
 * E2E da IDEMPOTÊNCIA da fila do Serviço Social (achado #7 da auditoria).
 *
 * Prova, em runtime, que os índices únicos PARCIAIS (só sobre status=PENDENTE)
 * fazem o que prometem:
 *   1) 1º registro PENDENTE → 201
 *   2) 2º idêntico (duplo-clique/retry) → 409 (e não 500)
 *   3) por ser PARCIAL, depois que o 1º sai de PENDENTE, recriar volta a 201
 *   4) o índice é específico (rota/tipo diferente NÃO é bloqueado)
 *
 * Uso: SENHA_ADMIN=... SENHA_DEV=... node scripts/valida-idempotencia.mjs
 *   SENHA_ADMIN = SEED_SUPER_ADMIN_PASSWORD (admin@ifp.local — Serviço Social)
 *   SENHA_DEV   = SEED_MEDICO_PASSWORD (medico@ifp.local — cria a sinalização da ponte)
 * Pré: seed rodado. O teste é auto-limpante (drena os PENDENTE da ficha antes
 * de cada bloco e resolve o que cria), então pode rodar repetidas vezes.
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

// ============================================================
// TRIAGEM — índice único parcial por (ficha) sobre PENDENTE
// ============================================================
console.log("--- TRIAGEM ---");
// Drena PENDENTE da ficha (o seed deixa o João com 1 triagem PENDENTE).
const tPend = await req(admin, "GET", "/servico-social/triagens?status=PENDENTE&perPage=100");
for (const t of tPend.json?.items ?? []) {
  if (t.fichaId !== fichaId) continue;
  await req(admin, "PATCH", `/servico-social/triagens/${t.id}/iniciar`);
  await req(admin, "PATCH", `/servico-social/triagens/${t.id}/concluir`);
}

const tc1 = await req(admin, "POST", "/servico-social/triagens", {
  fichaId,
  prioridade: "MEDIA",
  motivoSolicitacao: "QA idempotência",
});
caso("triagem 1ª PENDENTE → 201", 201, tc1.status);
const tc2 = await req(admin, "POST", "/servico-social/triagens", {
  fichaId,
  prioridade: "MEDIA",
  motivoSolicitacao: "QA duplicata",
});
caso("triagem 2ª (duplo-clique) → 409", 409, tc2.status);
// Tira a 1ª de PENDENTE e recria: o índice é PARCIAL, então deve liberar.
await req(admin, "PATCH", `/servico-social/triagens/${tc1.json?.id}/iniciar`);
await req(admin, "PATCH", `/servico-social/triagens/${tc1.json?.id}/concluir`);
const tc3 = await req(admin, "POST", "/servico-social/triagens", {
  fichaId,
  prioridade: "MEDIA",
  motivoSolicitacao: "QA pós-conclusão",
});
caso("triagem nova após concluir (índice PARCIAL) → 201", 201, tc3.status);
await req(admin, "PATCH", `/servico-social/triagens/${tc3.json?.id}/iniciar`);
await req(admin, "PATCH", `/servico-social/triagens/${tc3.json?.id}/concluir`);

// ============================================================
// ENCAMINHAMENTO — índice por (ficha, origem, destino) sobre PENDENTE
// ============================================================
console.log("--- ENCAMINHAMENTO ---");
const eHist = await req(admin, "GET", `/servico-social/encaminhamentos/${fichaId}/historico`);
for (const e of eHist.json?.items ?? []) {
  if (e.status === "PENDENTE") await req(admin, "PATCH", `/servico-social/encaminhamentos/${e.id}/aceitar`);
}

const ec1 = await req(admin, "POST", "/servico-social/encaminhamentos", {
  fichaId,
  unidadeOrigemSlug: "medico",
  unidadeDestinoSlug: "capacitacao",
  motivo: "QA idempotência",
});
caso("encaminhamento 1º (medico→capacitacao) → 201", 201, ec1.status);
const ec2 = await req(admin, "POST", "/servico-social/encaminhamentos", {
  fichaId,
  unidadeOrigemSlug: "medico",
  unidadeDestinoSlug: "capacitacao",
  motivo: "QA duplicata",
});
caso("encaminhamento 2º (mesma rota) → 409", 409, ec2.status);
// Rota diferente (mesmo origem, outro destino) NÃO deve ser bloqueada.
const ecDiff = await req(admin, "POST", "/servico-social/encaminhamentos", {
  fichaId,
  unidadeOrigemSlug: "medico",
  unidadeDestinoSlug: "esportivo",
  motivo: "QA rota diferente",
});
caso("encaminhamento outra rota (→esportivo) → 201", 201, ecDiff.status);
// Aceita a 1ª rota e recria: índice PARCIAL libera.
await req(admin, "PATCH", `/servico-social/encaminhamentos/${ec1.json?.id}/aceitar`);
const ec3 = await req(admin, "POST", "/servico-social/encaminhamentos", {
  fichaId,
  unidadeOrigemSlug: "medico",
  unidadeDestinoSlug: "capacitacao",
  motivo: "QA pós-aceite",
});
caso("encaminhamento mesma rota após aceitar (PARCIAL) → 201", 201, ec3.status);
await req(admin, "PATCH", `/servico-social/encaminhamentos/${ec3.json?.id}/aceitar`);
await req(admin, "PATCH", `/servico-social/encaminhamentos/${ecDiff.json?.id}/aceitar`);

// ============================================================
// PONTE — índice por (ficha, origem, tipo) sobre PENDENTE
// ============================================================
console.log("--- PONTE ---");
const pPend = await req(admin, "GET", "/servico-social/ponte?status=PENDENTE&perPage=100");
for (const s of pPend.json?.items ?? []) {
  if (s.fichaId !== fichaId) continue;
  await req(admin, "PATCH", `/servico-social/ponte/${s.id}/marcar-atendida`);
}

const pc1 = await req(medico, "POST", "/servico-social/ponte", {
  fichaId,
  tipo: "ALERTA",
  descricao: "QA idempotência",
});
caso("ponte 1ª (ALERTA) → 201", 201, pc1.status);
const pc2 = await req(medico, "POST", "/servico-social/ponte", {
  fichaId,
  tipo: "ALERTA",
  descricao: "QA duplicata",
});
caso("ponte 2ª (mesmo tipo) → 409", 409, pc2.status);
// Tipo diferente NÃO deve ser bloqueado.
const pcDiff = await req(medico, "POST", "/servico-social/ponte", {
  fichaId,
  tipo: "OBSERVACAO",
  descricao: "QA outro tipo",
});
caso("ponte outro tipo (OBSERVACAO) → 201", 201, pcDiff.status);
// Atende a 1ª e recria: índice PARCIAL libera.
await req(admin, "PATCH", `/servico-social/ponte/${pc1.json?.id}/marcar-atendida`);
const pc3 = await req(medico, "POST", "/servico-social/ponte", {
  fichaId,
  tipo: "ALERTA",
  descricao: "QA pós-atendimento",
});
caso("ponte mesmo tipo após atender (PARCIAL) → 201", 201, pc3.status);
await req(admin, "PATCH", `/servico-social/ponte/${pc3.json?.id}/marcar-atendida`);
await req(admin, "PATCH", `/servico-social/ponte/${pcDiff.json?.id}/marcar-atendida`);

const total = resultados.length;
const ok = resultados.filter(Boolean).length;
console.log(`\n${ok}/${total}`);
if (ok !== total) process.exit(1);
console.log(">>> IDEMPOTÊNCIA (Serviço Social) VALIDADA <<<");
