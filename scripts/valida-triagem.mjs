/**
 * E2E da TRIAGEM do Serviço Social (porta de entrada).
 * Uso: SENHA_ADMIN=... SENHA_DEV=... node scripts/valida-triagem.mjs
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

// Pega uma ficha (o médico tem acesso à busca; a triagem em si roda como admin/social).
const fr = await req(medico, "GET", "/medico/fichas?q=joao");
const fichaId = (fr.json?.items ?? [])[0]?.id;
if (!fichaId) {
  console.error("Nenhuma ficha encontrada — rode o seed.");
  process.exit(2);
}

console.log("--- ABRIR TRIAGEM ---");
const criar = await req(admin, "POST", "/servico-social/triagens", {
  fichaId,
  prioridade: "ALTA",
  motivoSolicitacao: "QA triagem",
});
caso("cria triagem → 201", 201, criar.status);
caso("nasce PENDENTE", "PENDENTE", criar.json?.status);
caso("prioridade ALTA", "ALTA", criar.json?.prioridade);
const triagemId = criar.json?.id;

console.log("--- FILA (KPIs + lista) ---");
const lista = await req(admin, "GET", "/servico-social/triagens");
caso("lista → 200", 200, lista.status);
caso("tem KPI naFila", true, typeof lista.json?.kpis?.naFila === "number");
caso("a triagem aparece na fila", true, (lista.json?.items ?? []).some((t) => t.id === triagemId));

console.log("--- DETALHE ---");
const det = await req(admin, "GET", `/servico-social/triagens/${triagemId}`);
caso("detalhe → 200", 200, det.status);
caso("traz a ficha", true, !!det.json?.ficha?.nomeCompleto);
caso("calcula diasEspera", true, typeof det.json?.diasEspera === "number");

console.log("--- TRANSIÇÕES ---");
const ini = await req(admin, "PATCH", `/servico-social/triagens/${triagemId}/iniciar`);
caso("inicia → 200 EM_ANDAMENTO", "EM_ANDAMENTO", ini.json?.status);
const iniDup = await req(admin, "PATCH", `/servico-social/triagens/${triagemId}/iniciar`);
caso("iniciar de novo → 409", 409, iniDup.status);
const conc = await req(admin, "PATCH", `/servico-social/triagens/${triagemId}/concluir`);
caso("conclui → 200 CONCLUIDA", "CONCLUIDA", conc.json?.status);

console.log("--- VALIDAÇÃO / RBAC ---");
const nf = await req(admin, "POST", "/servico-social/triagens", { fichaId: "ficha-inexistente" });
caso("ficha inexistente → 404", 404, nf.status);
const rbac = await req(medico, "GET", "/servico-social/triagens");
caso("médico (não-social) → 403", 403, rbac.status);

const total = resultados.length;
const ok = resultados.filter(Boolean).length;
console.log(`\n${ok}/${total}`);
if (ok !== total) process.exit(1);
console.log(">>> TRIAGEM (Serviço Social) VALIDADA <<<");
