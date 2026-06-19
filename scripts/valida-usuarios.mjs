/**
 * E2E ao vivo da GESTÃO DE USUÁRIOS + go-live de auth (criar conta, primeiro
 * acesso com senha provisória, troca obrigatória, reset, RBAC e tenant).
 *
 * Uso: SENHA_DEV=... node scripts/valida-usuarios.mjs
 *
 * Pré-requisitos: a API no ar e os usuários do seed com a senha unificada
 * (rode `pnpm --filter @ifp/database exec tsx scripts/padroniza-senhas-demo.ts`
 * — ele iguala a senha de todos os @ifp.local, inclusive admin@ e gestora@).
 */
const API = process.env.API_URL_TESTE ?? "http://127.0.0.1:3333/api/v1";
const SENHA = process.env.SENHA_DEV;
if (!SENHA) {
  console.error("Defina SENHA_DEV");
  process.exit(2);
}

async function loginFull(email, senha) {
  const r = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, senha }),
  });
  let json = null;
  try {
    json = await r.json();
  } catch {
    /* sem corpo */
  }
  return { status: r.status, token: json?.accessToken, user: json?.user };
}

async function login(email) {
  const r = await loginFull(email, SENHA);
  if (r.status !== 200) throw new Error(`login ${email}: ${r.status}`);
  return r.token;
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

// --- atores ---
const adminLogin = await loginFull("admin@ifp.local", SENHA);
if (adminLogin.status !== 200) {
  console.error(
    `Não consegui logar como admin@ifp.local (${adminLogin.status}). ` +
      "Rode o padroniza-senhas-demo.ts e confira SENHA_DEV.",
  );
  process.exit(2);
}
const admin = adminLogin.token;
const adminId = adminLogin.user.id;
const gestora = await login("gestora@ifp.local");
const familia = await login("familia@ifp.local");

const marca = Date.now().toString(36);
const emailNovo = `qa.prof.${marca}@ifp.local`;

console.log("--- CRIAÇÃO (admin) ---");
const criado = await req(admin, "POST", "/users", {
  nome: "QA Profissional",
  email: emailNovo,
  perfis: ["PROFISSIONAL"],
  unidades: ["educacional"],
});
caso("admin cria usuário", 201, criado.status);
const novoId = criado.json?.user?.id;
const provisoria = criado.json?.senhaProvisoria;
caso(
  "retorna senha provisória válida",
  true,
  typeof provisoria === "string" && provisoria.length >= 8,
);

const dup = await req(admin, "POST", "/users", {
  nome: "Duplicado",
  email: emailNovo,
  perfis: ["PROFISSIONAL"],
  unidades: ["educacional"],
});
caso("e-mail duplicado", 409, dup.status);

console.log("--- PRIMEIRO ACESSO (senha provisória) ---");
const senhaErrada = await loginFull(emailNovo, "senha-errada-000");
caso("login com senha errada", 401, senhaErrada.status);

const primeiro = await loginFull(emailNovo, provisoria);
caso("login com a provisória", 200, primeiro.status);
caso("mustChangePassword=true no 1º acesso", true, primeiro.user?.mustChangePassword === true);
const novoToken = primeiro.token;

const semAcesso = await req(novoToken, "GET", "/users");
caso("PROFISSIONAL não lista usuários (RBAC)", 403, semAcesso.status);

console.log("--- TROCA DE SENHA ---");
const trocaErrada = await req(novoToken, "POST", "/auth/trocar-senha", {
  senhaAtual: "qualquer-coisa",
  novaSenha: "NovaSenha#1",
});
caso("trocar com senha atual errada", 401, trocaErrada.status);

const novaSenha = "NovaSenha#1";
const troca = await req(novoToken, "POST", "/auth/trocar-senha", {
  senhaAtual: provisoria,
  novaSenha,
});
caso("troca de senha", 200, troca.status);

const relogin = await loginFull(emailNovo, novaSenha);
caso("login com a nova senha", 200, relogin.status);
caso("mustChangePassword=false após a troca", false, relogin.user?.mustChangePassword);

const igual = await req(relogin.token, "POST", "/auth/trocar-senha", {
  senhaAtual: novaSenha,
  novaSenha,
});
caso("nova senha igual à atual", 400, igual.status);

console.log("--- RESET (admin) ---");
const reset = await req(admin, "POST", `/users/${novoId}/reset-senha`);
caso("admin reseta senha", 200, reset.status);
const novaProv = reset.json?.senhaProvisoria;
const posReset = await loginFull(emailNovo, novaProv);
caso("login com a provisória do reset", 200, posReset.status);
caso("reset volta mustChangePassword=true", true, posReset.user?.mustChangePassword === true);

console.log("--- GATE SENHA PROVISÓRIA (server-side) ---");
// admin não pode resetar a própria senha (deve usar o fluxo de troca)
const selfReset = await req(admin, "POST", `/users/${adminId}/reset-senha`);
caso("admin não reseta a própria senha (400)", 400, selfReset.status);

// um GESTOR recém-criado teria a rota /users liberada pelo perfil, mas enquanto
// a senha for provisória o backend bloqueia TUDO (exceto trocar-senha/me).
const emailGestorProv = `qa.gprov.${marca}@ifp.local`;
const criaGestorProv = await req(admin, "POST", "/users", {
  nome: "QA Gestor Provisório",
  email: emailGestorProv,
  perfis: ["GESTOR_UNIDADE"],
  unidades: ["educacional"],
});
caso("admin cria gestor (provisório)", 201, criaGestorProv.status);
const gpId = criaGestorProv.json?.user?.id;
const gpProv = criaGestorProv.json?.senhaProvisoria;
const gpLogin = await loginFull(emailGestorProv, gpProv);
caso("gestor provisório loga", 200, gpLogin.status);
const gpToken = gpLogin.token;
const gpBloqueado = await req(gpToken, "GET", "/users");
caso("senha provisória bloqueia rota do perfil (403)", 403, gpBloqueado.status);
const gpMe = await req(gpToken, "GET", "/auth/me");
caso("auth/me liberado com senha provisória (200)", 200, gpMe.status);
const gpNovaSenha = "GestorNovo#1";
const gpTroca = await req(gpToken, "POST", "/auth/trocar-senha", {
  senhaAtual: gpProv,
  novaSenha: gpNovaSenha,
});
caso("gestor provisório troca senha (200)", 200, gpTroca.status);
const gpRelogin = await loginFull(emailGestorProv, gpNovaSenha);
const gpAcessa = await req(gpRelogin.token, "GET", "/users");
caso("gestor acessa /users após trocar a senha (200)", 200, gpAcessa.status);

console.log("--- RBAC / TENANT (gestor) ---");
const gCria = await req(gestora, "POST", "/users", {
  nome: "QA Gestor-Prof",
  email: `qa.gprof.${marca}@ifp.local`,
  perfis: ["PROFISSIONAL"],
  unidades: ["educacional"],
});
caso("gestor cria na própria unidade", 201, gCria.status);
const gProfId = gCria.json?.user?.id;

const gAdmin = await req(gestora, "POST", "/users", {
  nome: "Tentativa admin",
  email: `qa.gadm.${marca}@ifp.local`,
  perfis: ["SUPER_ADMIN"],
  unidades: ["educacional"],
});
caso("gestor não concede SUPER_ADMIN (RBAC)", 403, gAdmin.status);

const gFora = await req(gestora, "POST", "/users", {
  nome: "Fora da unidade",
  email: `qa.gfora.${marca}@ifp.local`,
  perfis: ["PROFISSIONAL"],
  unidades: ["medico"],
});
caso("gestor não cria fora da sua unidade (RBAC)", 403, gFora.status);

const gResetAdmin = await req(gestora, "POST", `/users/${adminId}/reset-senha`);
caso("gestor não gere usuário fora da unidade (404 anti-enum)", 404, gResetAdmin.status);

const famCria = await req(familia, "POST", "/users", {
  nome: "Família tentando",
  email: `qa.fam.${marca}@ifp.local`,
  perfis: ["PROFISSIONAL"],
  unidades: ["educacional"],
});
caso("família não cria usuário (RBAC)", 403, famCria.status);

console.log("--- ATIVAR / DESATIVAR ---");
const autoDesat = await req(admin, "PATCH", `/users/${adminId}/ativo`, { ativo: false });
caso("admin não desativa a si mesmo", 400, autoDesat.status);

const desat = await req(admin, "PATCH", `/users/${novoId}/ativo`, { ativo: false });
caso("admin desativa usuário", 200, desat.status);
const loginInativo = await loginFull(emailNovo, novaProv);
caso("usuário desativado não loga", 401, loginInativo.status);
const react = await req(admin, "PATCH", `/users/${novoId}/ativo`, { ativo: true });
caso("admin reativa usuário", 200, react.status);

const lista = await req(admin, "GET", "/users");
caso("admin lista usuários", 200, lista.status);
caso(
  "lista contém o criado",
  true,
  Boolean(lista.json?.items?.some((u) => u.id === novoId)),
);

// limpeza best-effort: desativa os usuários de teste criados nesta execução
await req(admin, "PATCH", `/users/${novoId}/ativo`, { ativo: false });
if (gProfId) await req(admin, "PATCH", `/users/${gProfId}/ativo`, { ativo: false });
if (gpId) await req(admin, "PATCH", `/users/${gpId}/ativo`, { ativo: false });

const total = resultados.length;
const ok = resultados.filter(Boolean).length;
console.log(`\n${ok}/${total}`);
if (ok !== total) process.exit(1);
console.log(">>> GESTÃO DE USUÁRIOS / AUTH VALIDADA <<<");
