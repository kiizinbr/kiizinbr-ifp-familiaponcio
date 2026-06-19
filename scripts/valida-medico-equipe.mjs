/**
 * E2E da gestão de equipe do Centro Médico (Bloco G): vincular usuário como
 * profissional, listar, candidatos, editar e RBAC/tenant.
 * Uso: SENHA_DEV=... node scripts/valida-medico-equipe.mjs
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

const admin = await login("admin@ifp.local");
const medico = await login("medico@ifp.local");
const familia = await login("familia@ifp.local");
const marca = Date.now().toString(36);

console.log("--- SETUP (usuário profissional médico) ---");
const novoUser = await req(admin, "POST", "/users", {
  nome: "QA Médico Novo",
  email: `qa.medico.${marca}@ifp.local`,
  perfis: ["PROFISSIONAL"],
  unidades: ["medico"],
});
caso("admin cria usuário profissional", 201, novoUser.status);
const userId = novoUser.json?.user?.id;

console.log("--- CANDIDATOS / VÍNCULO ---");
const cand = await req(admin, "GET", "/medico/equipe/candidatos");
caso("lista candidatos", 200, cand.status);
caso("usuário aparece como candidato", true, Boolean(cand.json?.items?.some((c) => c.id === userId)));

const vinc = await req(admin, "POST", "/medico/equipe", {
  userId,
  especialidade: "Pediatria",
  registroConselho: "52-12345-6",
});
caso("vincula profissional", 201, vinc.status);
const profId = vinc.json?.id;

const eq = await req(admin, "GET", "/medico/equipe");
caso("lista equipe", 200, eq.status);
caso("profissional aparece na equipe", true, Boolean(eq.json?.items?.some((p) => p.id === profId)));

const cand2 = await req(admin, "GET", "/medico/equipe/candidatos");
caso("candidato sai da lista após vincular", false, Boolean(cand2.json?.items?.some((c) => c.id === userId)));

const dup = await req(admin, "POST", "/medico/equipe", { userId });
caso("vincular duplicado barrado (409)", 409, dup.status);

console.log("--- EDIÇÃO ---");
const ed = await req(admin, "PATCH", `/medico/equipe/${profId}`, { ativo: false });
caso("inativa profissional", 200, ed.status);
caso("profissional fica inativo", false, ed.json?.ativo);

console.log("--- TENANT / RBAC ---");
const userEdu = await req(admin, "POST", "/users", {
  nome: "QA Edu",
  email: `qa.edu.${marca}@ifp.local`,
  perfis: ["PROFISSIONAL"],
  unidades: ["educacional"],
});
const vincFora = await req(admin, "POST", "/medico/equipe", { userId: userEdu.json?.user?.id });
caso("usuário de outra unidade barrado (400)", 400, vincFora.status);

const medEq = await req(medico, "GET", "/medico/equipe");
caso("profissional comum não gere equipe (RBAC)", 403, medEq.status);
const famVinc = await req(familia, "POST", "/medico/equipe", { userId });
caso("família não vincula (RBAC)", 403, famVinc.status);

// limpeza
await req(admin, "PATCH", `/users/${userId}/ativo`, { ativo: false });
if (userEdu.json?.user?.id) {
  await req(admin, "PATCH", `/users/${userEdu.json.user.id}/ativo`, { ativo: false });
}

const total = resultados.length;
const ok = resultados.filter(Boolean).length;
console.log(`\n${ok}/${total}`);
if (ok !== total) process.exit(1);
console.log(">>> EQUIPE MÉDICA VALIDADA <<<");
