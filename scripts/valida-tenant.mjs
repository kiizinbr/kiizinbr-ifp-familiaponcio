/**
 * Validação ao vivo da parede de tenant (sprint de segurança).
 * Uso: SENHA_DEV=... node scripts/valida-tenant.mjs
 * Espera: cruzado = 403, próprio = 200, busca cruzada = 403.
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
  const j = await r.json();
  return j.accessToken ?? j.access_token ?? j.token;
}

async function status(token, path) {
  const r = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return r.status;
}

const casos = [];
function caso(nome, esperado, obtido) {
  const ok = esperado === obtido;
  casos.push(ok);
  console.log(`${ok ? "✓" : "✗ FALHOU"} ${nome}: ${obtido} (espera ${esperado})`);
}

const instrutor = await login("instrutor@ifp.local");
const medico = await login("medico@ifp.local");
const educadora = await login("educadora@ifp.local");

console.log("--- PAREDE DE TENANT (cruzado deve ser 403) ---");
caso("instrutor -> /medico/agenda", 403, await status(instrutor, "/medico/agenda"));
caso("instrutor -> /medico/fichas?q=joao", 403, await status(instrutor, "/medico/fichas?q=joao"));
caso("medico -> /capacitacao/turmas", 403, await status(medico, "/capacitacao/turmas"));
caso("educadora -> /medico/agenda", 403, await status(educadora, "/medico/agenda"));
caso("educadora -> /capacitacao/turmas", 403, await status(educadora, "/capacitacao/turmas"));

console.log("--- CONTROLES POSITIVOS (próprio deve ser 200) ---");
caso("medico -> /medico/agenda", 200, await status(medico, "/medico/agenda"));
caso("instrutor -> /capacitacao/turmas", 200, await status(instrutor, "/capacitacao/turmas"));

const falhas = casos.filter((c) => !c).length;
console.log(falhas === 0 ? ">>> PAREDE DE TENANT VALIDADA <<<" : `>>> ${falhas} FALHA(S) <<<`);
process.exit(falhas === 0 ? 0 : 1);
