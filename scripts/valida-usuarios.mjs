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

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function loginFull(email, senha) {
  // O login tem rate-limit próprio (janela de 60s). Este script faz muitos
  // logins; ao bater 429 é preciso ESPERAR a janela FECHAR sem novas requisições
  // (polling reabastece a janela), então dormimos > 60s e tentamos de novo.
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const r = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha }),
    });
    if (r.status === 429) {
      await dormir(62000);
      continue;
    }
    let json = null;
    try {
      json = await r.json();
    } catch {
      /* sem corpo */
    }
    return { status: r.status, token: json?.accessToken, user: json?.user };
  }
  return { status: 429, token: undefined, user: undefined };
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
// O admin pode ter senha própria (SEED_SUPER_ADMIN_PASSWORD) quando as senhas
// do seed NÃO estão unificadas: tenta a senha dev e cai para a do admin.
let adminLogin = await loginFull("admin@ifp.local", SENHA);
if (adminLogin.status !== 200 && process.env.SENHA_ADMIN) {
  adminLogin = await loginFull("admin@ifp.local", process.env.SENHA_ADMIN);
}
if (adminLogin.status !== 200) {
  console.error(
    `Não consegui logar como admin@ifp.local (${adminLogin.status}). ` +
      "Rode o padroniza-senhas-demo.ts e confira SENHA_DEV/SENHA_ADMIN.",
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

console.log("--- MINHA CONTA (/auth/me enriquecido) ---");
const meAdmin = await req(admin, "GET", "/auth/me");
caso("auth/me responde 200", 200, meAdmin.status);
caso("auth/me traz nome", true, typeof meAdmin.json?.nome === "string" && meAdmin.json.nome.length > 0);
caso("auth/me traz email", true, meAdmin.json?.email === "admin@ifp.local");
caso("auth/me traz perfis (array)", true, Array.isArray(meAdmin.json?.perfis));
caso("auth/me traz unidades (array)", true, Array.isArray(meAdmin.json?.unidades));
caso("auth/me NÃO vaza senhaHash", true, meAdmin.json?.senhaHash === undefined);
const meFamilia = await req(familia, "GET", "/auth/me");
caso("família também acessa /auth/me", 200, meFamilia.status);

console.log("--- BUSCA GLOBAL (/busca) ---");
const buscaSemTermo = await req(admin, "GET", "/busca");
caso("busca sem termo responde 200", 200, buscaSemTermo.status);
caso("busca sem termo retorna vazio", 0, buscaSemTermo.json?.total);

const buscaCurta = await req(admin, "GET", "/busca?q=a");
caso("termo curto (<2) não busca", 0, buscaCurta.json?.total);

const buscaUsuario = await req(admin, "GET", `/busca?q=${encodeURIComponent("QA Profissional")}`);
caso("admin busca o usuário criado", 200, buscaUsuario.status);
caso(
  "resultado inclui o usuário criado",
  true,
  Boolean(buscaUsuario.json?.resultados?.some((r) => r.tipo === "usuario" && r.id === novoId)),
);
caso(
  "resultado de usuário tem href clicável",
  true,
  Boolean(
    buscaUsuario.json?.resultados
      ?.find((r) => r.id === novoId)
      ?.href?.startsWith("/admin/usuarios"),
  ),
);

const buscaFamilia = await req(familia, "GET", `/busca?q=${encodeURIComponent("QA Profissional")}`);
caso("família (RBAC) acessa busca mas não vê usuários", 200, buscaFamilia.status);
caso(
  "família não recebe resultados de usuário (RBAC)",
  true,
  !buscaFamilia.json?.resultados?.some((r) => r.tipo === "usuario"),
);

const buscaGestora = await req(gestora, "GET", `/busca?q=${encodeURIComponent("QA Gestor-Prof")}`);
caso("gestora busca dentro do escopo", 200, buscaGestora.status);
caso(
  "gestora encontra usuário da própria unidade",
  true,
  gProfId
    ? Boolean(buscaGestora.json?.resultados?.some((r) => r.tipo === "usuario" && r.id === gProfId))
    : true,
);
const buscaGestoraFora = await req(gestora, "GET", `/busca?q=${encodeURIComponent("admin@ifp.local")}`);
caso(
  "gestora NÃO encontra admin fora do seu escopo (RBAC)",
  true,
  !buscaGestoraFora.json?.resultados?.some((r) => r.tipo === "usuario" && r.id === adminId),
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
