/**
 * E2E dos ENCAMINHAMENTOS do Serviço Social (workflow entre unidades).
 * Uso: SENHA_ADMIN=... SENHA_DEV=... node scripts/valida-encaminhamentos.mjs
 *   SENHA_ADMIN = SEED_SUPER_ADMIN_PASSWORD (admin@ifp.local)
 *   SENHA_DEV   = SEED_MEDICO_PASSWORD (medico@ifp.local, p/ teste de RBAC)
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

// João está APROVADO no médico (seed) — origem válida para encaminhar.
const fr = await req(medico, "GET", "/medico/fichas?q=joao");
const fichaId = (fr.json?.items ?? [])[0]?.id;
if (!fichaId) {
  console.error("Nenhuma ficha encontrada — rode o seed.");
  process.exit(2);
}

// Estado limpo: o seed deixa o João com encaminhamento medico→capacitacao
// PENDENTE; com o índice único parcial recriar daria 409. Drena (aceita) antes
// de testar o caminho feliz — torna o script re-executável sem reseed.
const histPend = await req(admin, "GET", `/servico-social/encaminhamentos/${fichaId}/historico`);
for (const e of histPend.json?.items ?? []) {
  if (e.status === "PENDENTE") await req(admin, "PATCH", `/servico-social/encaminhamentos/${e.id}/aceitar`);
}

console.log("--- CRIAR (regra: origem aprovada) ---");
const criar = await req(admin, "POST", "/servico-social/encaminhamentos", {
  fichaId,
  unidadeOrigemSlug: "medico",
  unidadeDestinoSlug: "capacitacao",
  prioridade: "NORMAL",
  motivo: "QA encaminhamento",
});
caso("cria → 201", 201, criar.status);
caso("nasce PENDENTE", "PENDENTE", criar.json?.status);
caso("traz origem→destino", true, !!criar.json?.unidadeOrigem && !!criar.json?.unidadeDestino);
const encId = criar.json?.id;

const semApr = await req(admin, "POST", "/servico-social/encaminhamentos", {
  fichaId,
  unidadeOrigemSlug: "educacional", // João NÃO é aprovado aqui
  unidadeDestinoSlug: "medico",
  motivo: "QA sem aprovação na origem",
});
caso("origem não aprovada → 409", 409, semApr.status);

const mesmaUnid = await req(admin, "POST", "/servico-social/encaminhamentos", {
  fichaId,
  unidadeOrigemSlug: "medico",
  unidadeDestinoSlug: "medico",
  motivo: "QA origem=destino",
});
caso("origem = destino → 400", 400, mesmaUnid.status);

console.log("--- LISTA (KPIs) ---");
const lista = await req(admin, "GET", "/servico-social/encaminhamentos?status=PENDENTE");
caso("lista → 200", 200, lista.status);
caso("tem KPI pendentes", true, typeof lista.json?.kpis?.pendentes === "number");
caso("tem KPI tempoMedioDias", true, typeof lista.json?.kpis?.tempoMedioDias === "number");

console.log("--- RECUSAR (exige justificativa) ---");
const recSemJust = await req(admin, "PATCH", `/servico-social/encaminhamentos/${encId}/recusar`, {});
caso("recusar sem justificativa → 400", 400, recSemJust.status);

console.log("--- ACEITAR + idempotência ---");
const aceitar = await req(admin, "PATCH", `/servico-social/encaminhamentos/${encId}/aceitar`);
caso("aceita → ACEITO", "ACEITO", aceitar.json?.status);
const aceitarDup = await req(admin, "PATCH", `/servico-social/encaminhamentos/${encId}/aceitar`);
caso("aceitar de novo → 409", 409, aceitarDup.status);
const recusarAposAceite = await req(admin, "PATCH", `/servico-social/encaminhamentos/${encId}/recusar`, {
  justificativaResposta: "tarde demais",
});
caso("recusar já aceito → 409", 409, recusarAposAceite.status);

console.log("--- HISTÓRICO ---");
const hist = await req(admin, "GET", `/servico-social/encaminhamentos/${fichaId}/historico`);
caso("histórico → 200", 200, hist.status);
caso("histórico devolve array em items", true, Array.isArray(hist.json?.items));
caso("histórico tem itens", true, (hist.json?.items ?? []).length > 0);
// Todo item é desta ficha e traz origem→destino + status (timeline coerente p/ a UI).
const histItems = hist.json?.items ?? [];
caso(
  "todo item é da ficha consultada",
  true,
  histItems.every((e) => e.fichaId === fichaId),
);
caso(
  "todo item traz origem→destino e status",
  true,
  histItems.every((e) => !!e.unidadeOrigem && !!e.unidadeDestino && !!e.status),
);
// Ordenação esperada: mais recentes primeiro (criadoEm desc).
caso(
  "histórico ordenado por criadoEm desc",
  true,
  histItems.every((e, i) => i === 0 || new Date(histItems[i - 1].criadoEm) >= new Date(e.criadoEm)),
);
// Histórico de ficha inexistente → 200 com array vazio (não 500).
const histVazio = await req(admin, "GET", `/servico-social/encaminhamentos/ficha-inexistente-xyz/historico`);
caso("histórico de ficha inexistente → 200", 200, histVazio.status);
caso("histórico de ficha inexistente → array vazio", 0, (histVazio.json?.items ?? []).length);

console.log("--- RBAC ---");
const rbac = await req(medico, "GET", "/servico-social/encaminhamentos");
caso("médico (não-social) → 403", 403, rbac.status);

const total = resultados.length;
const ok = resultados.filter(Boolean).length;
console.log(`\n${ok}/${total}`);
if (ok !== total) process.exit(1);
console.log(">>> ENCAMINHAMENTOS (Serviço Social) VALIDADOS <<<");
