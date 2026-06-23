/**
 * E2E ao vivo do AUTO-PROVISIONAMENTO DO ACESSO DA FAMÍLIA (C5).
 *
 * Ao aprovar/atender uma família, o Serviço Social gera o acesso do responsável
 * REUSANDO o fluxo de 1º acesso da gestão de usuários: cria um User
 * RESPONSAVEL_FAMILIAR vinculado à FichaCidada (User.fichaCidadaId) com senha
 * PROVISÓRIA e mustChangePassword=true. A senha aparece UMA vez na resposta
 * (o sistema NÃO envia e-mail). Idempotente: gerar de novo na mesma ficha
 * devolve o estado SEM nova senha.
 *
 * Cobre:
 *  - admin (SUPER_ADMIN) gera acesso → 201 + senha provisória válida + RESPONSAVEL_FAMILIAR;
 *  - família loga com a provisória → 200 e mustChangePassword=true;
 *  - gerar de novo na MESMA ficha → idempotente (jaExistia=true, senhaProvisoria=null);
 *  - SERVICO_SOCIAL (erick.social) também gera acesso (RBAC do gate);
 *  - perfil errado (PROFISSIONAL/RESPONSAVEL_FAMILIAR) → 403; sem token → 401;
 *  - a resposta e o GET de estado NUNCA vazam senhaHash;
 *  - ficha inexistente → 404.
 *
 * Anti-flaky: cria a própria ficha (CPF aleatório) e age sobre o ID que criou.
 *
 * Uso: SENHA_ADMIN=<senha admin> SENHA_DEV=<senha dev/profissionais> \
 *      node scripts/valida-admin-provisionamento.mjs
 */
const API = process.env.API_URL_TESTE ?? "http://127.0.0.1:3333/api/v1";
const SENHA = process.env.SENHA_DEV;
const SENHA_ADMIN = process.env.SENHA_ADMIN ?? SENHA;
if (!SENHA) {
  console.error("Defina SENHA_DEV (e SENHA_ADMIN)");
  process.exit(2);
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** Login resiliente ao rate-limit (429 → espera a janela de 60s fechar). */
async function loginFull(email, senha) {
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
    return { status: r.status, token: json?.accessToken ?? json?.token, user: json?.user };
  }
  return { status: 429, token: undefined, user: undefined };
}

async function login(email, senha = SENHA) {
  const r = await loginFull(email, senha);
  if (r.status !== 200) throw new Error(`login ${email}: ${r.status}`);
  return r.token;
}

async function req(token, method, path, body) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const r = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
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
  const okc = esperado === obtido;
  resultados.push(okc);
  console.log(
    `${okc ? "✓" : "✗ FALHOU"} ${nome}: ${JSON.stringify(obtido)} (espera ${JSON.stringify(esperado)})`,
  );
}
function ok(nome, cond) {
  resultados.push(Boolean(cond));
  console.log(`${cond ? "✓" : "✗ FALHOU"} ${nome}`);
}

/** CPF de 11 dígitos pseudo-aleatório (não precisa ser válido p/ o teste). */
function cpfAleatorio() {
  let s = "";
  for (let i = 0; i < 11; i++) s += Math.floor(Math.random() * 10);
  return s;
}

/** Garante que nenhum objeto da resposta vaze o hash da senha. */
function semHash(obj) {
  return JSON.stringify(obj ?? {}).toLowerCase().includes("senhahash") === false;
}

const admin = await login("admin@ifp.local", SENHA_ADMIN); // SUPER_ADMIN passa no gate
const familia = await login("familia@ifp.local"); // RESPONSAVEL_FAMILIAR (perfil errado)
const medico = await login("medico@ifp.local"); // PROFISSIONAL (perfil errado)

// Ator SERVICO_SOCIAL determinístico: criamos via gestão de usuários (não
// dependemos da senha de seed das personas `erick.*`, que usam outra var).
const marca = Date.now().toString(36);
const emailSocial = `qa.social.${marca}@ifp.local`;
const senhaSocial = "SocialQA#1";
const criaSocial = await req(admin, "POST", "/users", {
  nome: "QA Serviço Social",
  email: emailSocial,
  perfis: ["SERVICO_SOCIAL"],
});
caso("admin cria usuário SERVICO_SOCIAL (201)", 201, criaSocial.status);
const socialId = criaSocial.json?.user?.id;
const provSocial = criaSocial.json?.senhaProvisoria;
// Loga com a provisória e troca a senha (o gate provisório barra rotas além de
// me/trocar-senha), depois re-loga para obter um token pleno.
const socialPrimeiro = await loginFull(emailSocial, provSocial);
await req(socialPrimeiro.token, "POST", "/auth/trocar-senha", {
  senhaAtual: provSocial,
  novaSenha: senhaSocial,
});
const social = await login(emailSocial, senhaSocial); // SERVICO_SOCIAL passa no gate

console.log("--- SETUP: cria a ficha que vou provisionar (sem e-mail) ---");
const criada = await req(admin, "POST", "/fichas-cidadas", {
  nomeCompleto: "Responsavel Provisionamento QA",
  cpf: cpfAleatorio(),
  dataNascimento: "1990-05-12",
  telefone: "2133331111",
});
caso("admin cria ficha base (201)", 201, criada.status);
const fichaId = criada.json?.id;
ok("ficha criada tem id", Boolean(fichaId));

console.log("--- ESTADO INICIAL: sem acesso ---");
const estado0 = await req(admin, "GET", `/fichas-cidadas/${fichaId}/acesso-familia`);
caso("GET estado inicial (200)", 200, estado0.status);
caso("ficha ainda NÃO possui acesso", false, estado0.json?.possuiAcesso);
ok("GET estado não vaza senhaHash", semHash(estado0.json));

console.log("--- GERAR ACESSO (admin) → 201 + senha provisória ---");
const gerar = await req(admin, "POST", `/fichas-cidadas/${fichaId}/acesso-familia`);
caso("admin gera acesso (201)", 201, gerar.status);
caso("não é idempotente na 1ª vez (jaExistia=false)", false, gerar.json?.jaExistia);
const provisoria = gerar.json?.senhaProvisoria;
ok(
  "retorna senha provisória válida",
  typeof provisoria === "string" && provisoria.length >= 8,
);
const emailAcesso = gerar.json?.acesso?.email;
ok("acesso traz o e-mail de login", typeof emailAcesso === "string" && emailAcesso.length > 0);
caso("acesso nasce com mustChangePassword=true", true, gerar.json?.acesso?.mustChangePassword);
ok("resposta da geração NÃO vaza senhaHash", semHash(gerar.json));

console.log("--- ESTADO PÓS-GERAÇÃO ---");
const estado1 = await req(admin, "GET", `/fichas-cidadas/${fichaId}/acesso-familia`);
caso("ficha agora POSSUI acesso", true, estado1.json?.possuiAcesso);
caso("estado traz o mesmo e-mail", emailAcesso, estado1.json?.acesso?.email);
ok("GET estado pós-geração não vaza senhaHash", semHash(estado1.json));

console.log("--- FAMÍLIA LOGA COM A PROVISÓRIA → 200 + 1º acesso ---");
const senhaErrada = await loginFull(emailAcesso, "senha-errada-000");
caso("login da família com senha errada → 401", 401, senhaErrada.status);

const loginFam = await loginFull(emailAcesso, provisoria);
caso("família loga com a provisória (200)", 200, loginFam.status);
caso("mustChangePassword=true no 1º acesso", true, loginFam.user?.mustChangePassword === true);
caso(
  "login traz o perfil RESPONSAVEL_FAMILIAR",
  true,
  Array.isArray(loginFam.user?.perfis) && loginFam.user.perfis.includes("RESPONSAVEL_FAMILIAR"),
);
ok("payload de login NÃO vaza senhaHash", semHash(loginFam.user));

console.log("--- IDEMPOTÊNCIA: gerar de novo na MESMA ficha ---");
const denovo = await req(admin, "POST", `/fichas-cidadas/${fichaId}/acesso-familia`);
caso("gerar de novo ainda responde 201", 201, denovo.status);
caso("idempotente: jaExistia=true", true, denovo.json?.jaExistia);
caso("idempotente: NÃO emite nova senha", null, denovo.json?.senhaProvisoria);
caso(
  "idempotente: aponta para o MESMO usuário",
  estado1.json?.acesso?.id,
  denovo.json?.acesso?.id,
);
ok("resposta idempotente NÃO vaza senhaHash", semHash(denovo.json));

console.log("--- SERVICO_SOCIAL também provisiona (RBAC do gate) ---");
const fichaSocial = await req(admin, "POST", "/fichas-cidadas", {
  nomeCompleto: "Responsavel via Social QA",
  cpf: cpfAleatorio(),
  dataNascimento: "1988-09-03",
  telefone: "2133332222",
});
const fichaSocialId = fichaSocial.json?.id;
const gerarSocial = await req(social, "POST", `/fichas-cidadas/${fichaSocialId}/acesso-familia`);
caso("serviço social gera acesso (201)", 201, gerarSocial.status);
ok(
  "social: senha provisória válida",
  typeof gerarSocial.json?.senhaProvisoria === "string" &&
    gerarSocial.json.senhaProvisoria.length >= 8,
);

console.log("--- RBAC (perfil errado → 403; sem token → 401) ---");
caso(
  "família (RESPONSAVEL_FAMILIAR) → POST acesso (403)",
  403,
  (await req(familia, "POST", `/fichas-cidadas/${fichaId}/acesso-familia`)).status,
);
caso(
  "médico (PROFISSIONAL) → POST acesso (403)",
  403,
  (await req(medico, "POST", `/fichas-cidadas/${fichaId}/acesso-familia`)).status,
);
caso(
  "família → GET estado do acesso (403)",
  403,
  (await req(familia, "GET", `/fichas-cidadas/${fichaId}/acesso-familia`)).status,
);
caso(
  "sem token → POST acesso (401)",
  401,
  (await req(null, "POST", `/fichas-cidadas/${fichaId}/acesso-familia`)).status,
);

console.log("--- FICHA INEXISTENTE → 404 ---");
caso(
  "gerar acesso de ficha inexistente → 404",
  404,
  (await req(admin, "POST", "/fichas-cidadas/ficha-que-nao-existe/acesso-familia")).status,
);
caso(
  "GET estado de ficha inexistente → 404",
  404,
  (await req(admin, "GET", "/fichas-cidadas/ficha-que-nao-existe/acesso-familia")).status,
);

// limpeza best-effort: desativa o usuário SERVICO_SOCIAL de teste.
if (socialId) await req(admin, "PATCH", `/users/${socialId}/ativo`, { ativo: false });

const total = resultados.length;
const okc = resultados.filter(Boolean).length;
console.log(`\n${okc}/${total}`);
if (okc !== total) process.exit(1);
console.log(">>> AUTO-PROVISIONAMENTO DO ACESSO DA FAMÍLIA VALIDADO <<<");
