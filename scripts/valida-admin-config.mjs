/**
 * E2E ao vivo do PAINEL DE CONFIGURAÇÃO da plataforma (A6):
 *  - GET /admin/config: SUPER_ADMIN lê (200); perfis comuns → 403.
 *  - Estrutura: unidades + tiposUnidade + perfis + parâmetros (catálogo).
 *  - PUT /admin/config/parametros/:chave: persiste + reflete no GET seguinte.
 *  - Validação por tipo (boolean/number/limites) → 400; chave fora da whitelist → 404.
 *  - Auditoria LGPD: o UPDATE deixa rastro na trilha (/admin/auditoria).
 *
 * Uso: SENHA_ADMIN=... SENHA_DEV=... node scripts/valida-admin-config.mjs
 */
const API = process.env.API_URL_TESTE ?? "http://127.0.0.1:3333/api/v1";
const SENHA_ADMIN = process.env.SENHA_ADMIN;
const SENHA_DEV = process.env.SENHA_DEV;
if (!SENHA_ADMIN || !SENHA_DEV) {
  console.error("Defina SENHA_ADMIN e SENHA_DEV");
  process.exit(2);
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(email, senha) {
  for (let tentativa = 0; tentativa < 8; tentativa++) {
    const r = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha }),
    });
    if (r.status === 429) {
      await dormir(8000);
      continue;
    }
    if (!r.ok) throw new Error(`login ${email}: ${r.status}`);
    return (await r.json()).accessToken;
  }
  throw new Error(`login ${email}: 429 (rate-limit persistente)`);
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
  console.log(
    `${ok ? "✓" : "✗ FALHOU"} ${nome}: ${JSON.stringify(obtido)} (espera ${JSON.stringify(esperado)})`,
  );
}
function ok(nome, cond) {
  resultados.push(Boolean(cond));
  console.log(`${cond ? "✓" : "✗ FALHOU"} ${nome}`);
}

const admin = await login("admin@ifp.local", SENHA_ADMIN);
const gestora = await login("gestora@ifp.local", SENHA_DEV);
const familia = await login("familia@ifp.local", SENHA_DEV);
const medico = await login("medico@ifp.local", SENHA_DEV);

// ============================================================
console.log("--- RBAC: GET /admin/config (SUPER_ADMIN only) ---");
const cfg = await req(admin, "GET", "/admin/config");
caso("admin lê config (200)", 200, cfg.status);
caso("gestor de unidade bloqueado (403)", 403, (await req(gestora, "GET", "/admin/config")).status);
caso("família bloqueada (403)", 403, (await req(familia, "GET", "/admin/config")).status);
caso("profissional médico bloqueado (403)", 403, (await req(medico, "GET", "/admin/config")).status);

console.log("--- CONFIG: estrutura ---");
ok("config traz unidades (array)", Array.isArray(cfg.json?.unidades));
ok("config lista as 4 unidades do seed", (cfg.json?.unidades?.length ?? 0) >= 4);
ok(
  "unidade traz resumo (slug + contagem)",
  cfg.json?.unidades?.every(
    (u) => typeof u.slug === "string" && typeof u.usuarios === "number" && typeof u.ativo === "boolean",
  ),
);
ok("config lista tiposUnidade", Array.isArray(cfg.json?.tiposUnidade) && cfg.json.tiposUnidade.includes("MEDICO"));
ok("config lista perfis", Array.isArray(cfg.json?.perfis) && cfg.json.perfis.includes("SUPER_ADMIN"));
ok("config traz parâmetros (array)", Array.isArray(cfg.json?.parametros));
ok("há ≥1 parâmetro no catálogo", (cfg.json?.parametros?.length ?? 0) >= 1);
ok(
  "parâmetro traz chave/tipo/valor/padrao",
  cfg.json?.parametros?.every(
    (p) =>
      typeof p.chave === "string" &&
      ["boolean", "number", "string"].includes(p.tipo) &&
      "valor" in p &&
      "padrao" in p &&
      typeof p.personalizado === "boolean",
  ),
);

// Pega um parâmetro numérico e um booleano do catálogo p/ exercitar o PUT.
const pNum = cfg.json?.parametros?.find((p) => p.tipo === "number");
const pBool = cfg.json?.parametros?.find((p) => p.tipo === "boolean");
ok("existe parâmetro numérico no catálogo", Boolean(pNum));
ok("existe parâmetro booleano no catálogo", Boolean(pBool));

// ============================================================
console.log("--- PUT: ajustar parâmetro numérico (persiste) ---");
if (pNum) {
  const dentro = Math.min(
    pNum.max ?? Number(pNum.valor) + 1,
    Math.max(pNum.min ?? 0, Number(pNum.valor) === (pNum.min ?? 0) ? (pNum.min ?? 0) + 1 : Number(pNum.valor) - 1),
  );
  const novo = dentro === Number(pNum.valor) ? dentro + 1 : dentro;

  const put = await req(admin, "PUT", `/admin/config/parametros/${encodeURIComponent(pNum.chave)}`, {
    valor: novo,
  });
  caso("admin ajusta parâmetro numérico (200)", 200, put.status);
  caso("resposta reflete novo valor", novo, put.json?.valor);
  caso("parâmetro marcado como personalizado", true, put.json?.personalizado);

  // Confirma persistência relendo a config.
  const recfg = await req(admin, "GET", "/admin/config");
  const reler = recfg.json?.parametros?.find((p) => p.chave === pNum.chave);
  caso("GET seguinte reflete o valor persistido", novo, reler?.valor);

  // Validação de tipo/limites.
  const tipoErrado = await req(admin, "PUT", `/admin/config/parametros/${encodeURIComponent(pNum.chave)}`, {
    valor: "isso-nao-e-numero",
  });
  caso("valor de tipo errado → 400", 400, tipoErrado.status);

  if (pNum.max !== undefined) {
    const acima = await req(admin, "PUT", `/admin/config/parametros/${encodeURIComponent(pNum.chave)}`, {
      valor: pNum.max + 1,
    });
    caso("valor acima do máximo → 400", 400, acima.status);
  }

  // Restaura o padrão para não contaminar outras validações.
  await req(admin, "PUT", `/admin/config/parametros/${encodeURIComponent(pNum.chave)}`, {
    valor: pNum.padrao,
  });
}

console.log("--- PUT: ajustar parâmetro booleano ---");
if (pBool) {
  const novo = !pBool.valor;
  const put = await req(admin, "PUT", `/admin/config/parametros/${encodeURIComponent(pBool.chave)}`, {
    valor: novo,
  });
  caso("admin ajusta parâmetro booleano (200)", 200, put.status);
  caso("resposta reflete novo booleano", novo, put.json?.valor);

  const tipoErrado = await req(admin, "PUT", `/admin/config/parametros/${encodeURIComponent(pBool.chave)}`, {
    valor: 123,
  });
  caso("booleano com número → 400", 400, tipoErrado.status);

  // restaura
  await req(admin, "PUT", `/admin/config/parametros/${encodeURIComponent(pBool.chave)}`, {
    valor: pBool.padrao,
  });
}

console.log("--- RBAC + whitelist no PUT ---");
const chaveQualquer = pNum?.chave ?? pBool?.chave ?? "plataforma.nomeExibicao";
caso(
  "família não ajusta parâmetro (403)",
  403,
  (await req(familia, "PUT", `/admin/config/parametros/${encodeURIComponent(chaveQualquer)}`, { valor: 1 })).status,
);
caso(
  "gestor não ajusta parâmetro (403)",
  403,
  (await req(gestora, "PUT", `/admin/config/parametros/${encodeURIComponent(chaveQualquer)}`, { valor: 1 })).status,
);
caso(
  "chave fora da whitelist → 404",
  404,
  (await req(admin, "PUT", "/admin/config/parametros/chave.inexistente.qualquer", { valor: 1 })).status,
);

// ============================================================
console.log("--- AUDITORIA LGPD: alteração deixa rastro ---");
// Faz um UPDATE conhecido e procura na trilha de auditoria por entidade=Configuracao.
if (pBool) {
  await req(admin, "PUT", `/admin/config/parametros/${encodeURIComponent(pBool.chave)}`, {
    valor: !pBool.padrao,
  });
  await req(admin, "PUT", `/admin/config/parametros/${encodeURIComponent(pBool.chave)}`, {
    valor: pBool.padrao,
  });
}
const trilha = await req(admin, "GET", "/admin/auditoria?entidade=Configuracao&acao=UPDATE&perPage=5");
caso("trilha de Configuracao acessível (200)", 200, trilha.status);
ok("UPDATE de Configuracao registrado na auditoria", (trilha.json?.pagination?.total ?? 0) >= 1);
ok(
  "evento de auditoria traz de/para nos metadados",
  trilha.json?.items?.some((l) => l.metadados && "de" in l.metadados && "para" in l.metadados),
);

// A própria leitura da config também é auditada (READ de Configuracao).
const trilhaRead = await req(admin, "GET", "/admin/auditoria?entidade=Configuracao&acao=READ&perPage=3");
ok("READ da config também é auditado", (trilhaRead.json?.pagination?.total ?? 0) >= 1);

const total = resultados.length;
const okN = resultados.filter(Boolean).length;
console.log(`\n${okN}/${total}`);
if (okN !== total) process.exit(1);
console.log(">>> PAINEL DE CONFIGURAÇÃO (A6) VALIDADO <<<");
