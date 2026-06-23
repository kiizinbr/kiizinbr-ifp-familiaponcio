/**
 * E2E ao vivo da ADMINISTRAÇÃO / GOVERNANÇA LGPD (U9):
 *  - Trilha de auditoria: SUPER_ADMIN lê/filtra/exporta; perfis comuns → 403.
 *  - CRUD de unidades (tenants): listar/editar/desativar/reativar; tipo único → 409.
 *  - Entrega de comunicados: cobertura de leitura agregada; RBAC.
 *
 * Uso: SENHA_ADMIN=... SENHA_DEV=... node scripts/valida-admin.mjs
 * (admin@ usa a senha do Super Admin; os demais @ifp.local usam a senha "dev").
 */
const API = process.env.API_URL_TESTE ?? "http://127.0.0.1:3333/api/v1";
// admin@ usa a senha do Super Admin; os demais @ifp.local usam a senha "dev".
const SENHA_ADMIN = process.env.SENHA_ADMIN;
const SENHA_DEV = process.env.SENHA_DEV;
if (!SENHA_ADMIN || !SENHA_DEV) {
  console.error("Defina SENHA_ADMIN e SENHA_DEV");
  process.exit(2);
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(email, senha) {
  // O login tem rate-limit próprio (10/min); em 429 esperamos a janela e repetimos.
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

async function reqRaw(token, path) {
  const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const texto = await r.text();
  return { status: r.status, contentType: r.headers.get("content-type") ?? "", texto };
}

const resultados = [];
function caso(nome, esperado, obtido) {
  const ok = esperado === obtido;
  resultados.push(ok);
  console.log(`${ok ? "✓" : "✗ FALHOU"} ${nome}: ${JSON.stringify(obtido)} (espera ${JSON.stringify(esperado)})`);
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
console.log("--- RBAC: trilha de auditoria (SUPER_ADMIN only) ---");
const audAdmin = await req(admin, "GET", "/admin/auditoria");
caso("admin lê auditoria (200)", 200, audAdmin.status);
caso("gestor de unidade bloqueado (403)", 403, (await req(gestora, "GET", "/admin/auditoria")).status);
caso("família bloqueada (403)", 403, (await req(familia, "GET", "/admin/auditoria")).status);
caso("profissional médico bloqueado (403)", 403, (await req(medico, "GET", "/admin/auditoria")).status);

ok("auditoria devolve items (array)", Array.isArray(audAdmin.json?.items));
ok("auditoria tem paginação", typeof audAdmin.json?.pagination?.total === "number");
ok(
  "linha de auditoria não vaza userAgent",
  audAdmin.json?.items?.every((l) => !("userAgent" in l)),
);
ok(
  "linha traz ação + entidade",
  audAdmin.json?.items?.every((l) => typeof l.acao === "string" && typeof l.entidade === "string"),
);

console.log("--- AUDITORIA: facetas e filtros ---");
const facetas = await req(admin, "GET", "/admin/auditoria/facetas");
caso("facetas (200)", 200, facetas.status);
ok("facetas listam ações", Array.isArray(facetas.json?.acoes) && facetas.json.acoes.includes("READ"));
ok("facetas listam entidades", Array.isArray(facetas.json?.entidades));

// A própria leitura acima JÁ gerou eventos READ de "AuditLog" — filtramos por eles.
const filtroAcao = await req(admin, "GET", "/admin/auditoria?acao=READ&entidade=AuditLog&perPage=5");
caso("filtro por ação+entidade (200)", 200, filtroAcao.status);
ok("filtro perPage respeitado (<=5)", (filtroAcao.json?.items?.length ?? 99) <= 5);
ok(
  "filtro só traz a ação pedida",
  filtroAcao.json?.items?.every((l) => l.acao === "READ"),
);
ok(
  "filtro só traz a entidade pedida",
  filtroAcao.json?.items?.every((l) => l.entidade === "AuditLog"),
);

const filtroAtor = await req(
  admin,
  "GET",
  `/admin/auditoria?ator=naoexiste-cuid-000&perPage=5`,
);
caso("filtro por ator inexistente (200)", 200, filtroAtor.status);
caso("ator inexistente → 0 resultados", 0, filtroAtor.json?.pagination?.total);

const filtroDataInvalida = await req(admin, "GET", "/admin/auditoria?de=nao-e-data");
caso("data inválida → 400", 400, filtroDataInvalida.status);

console.log("--- AUDITORIA: export CSV (gera evento EXPORT) ---");
const csv = await reqRaw(admin, "/admin/auditoria/export.csv?entidade=AuditLog&perPage=50");
caso("export csv (200)", 200, csv.status);
ok("content-type csv", csv.contentType.includes("text/csv"));
ok("csv tem cabeçalho esperado", csv.texto.includes("dataHora") && csv.texto.includes("acao"));
caso("export bloqueado p/ família (403)", 403, (await reqRaw(familia, "/admin/auditoria/export.csv")).status);

// Confirma que o EXPORT virou trilha (governança audita quem exportou).
const aposExport = await req(admin, "GET", "/admin/auditoria?acao=EXPORT&entidade=AuditLog&perPage=3");
ok("export deixou rastro EXPORT na trilha", (aposExport.json?.pagination?.total ?? 0) >= 1);

// ============================================================
console.log("--- UNIDADES: listar (SUPER_ADMIN only) ---");
const unids = await req(admin, "GET", "/admin/unidades");
caso("admin lista unidades (200)", 200, unids.status);
caso("gestor bloqueado em unidades (403)", 403, (await req(gestora, "GET", "/admin/unidades")).status);
caso("família bloqueada em unidades (403)", 403, (await req(familia, "GET", "/admin/unidades")).status);
ok("lista tem as 4 unidades do seed", (unids.json?.items?.length ?? 0) >= 4);
const medicoUnid = unids.json?.items?.find((u) => u.slug === "medico");
ok("unidade médico presente", Boolean(medicoUnid));
ok("unidade traz contagem de usuários", typeof medicoUnid?._count?.usuarios === "number");

console.log("--- UNIDADES: criar (tipo único → 409) ---");
const dupTipo = await req(admin, "POST", "/admin/unidades", {
  tipo: "MEDICO",
  nome: "Outro Médico",
  slug: "medico-2",
});
caso("criar tipo já existente → 409", 409, dupTipo.status);

const dupSlug = await req(admin, "POST", "/admin/unidades", {
  tipo: "ESPORTIVO",
  nome: "Slug repetido",
  slug: "medico",
});
caso("criar slug já existente → 409", 409, dupSlug.status);

const slugInvalido = await req(admin, "POST", "/admin/unidades", {
  tipo: "MEDICO",
  nome: "X",
  slug: "Slug Com Espaco",
});
caso("slug inválido → 400", 400, slugInvalido.status);

const familiaCriaUnid = await req(familia, "POST", "/admin/unidades", {
  tipo: "MEDICO",
  nome: "Hack",
  slug: "hack",
});
caso("família não cria unidade (403)", 403, familiaCriaUnid.status);

console.log("--- UNIDADES: editar / desativar / reativar ---");
const nomeOriginal = medicoUnid?.nome;
const novoNome = `Centro Médico IFP · QA ${Date.now().toString(36)}`;
const editado = await req(admin, "PATCH", `/admin/unidades/${medicoUnid.id}`, { nome: novoNome });
caso("admin edita nome da unidade (200)", 200, editado.status);
caso("nome atualizado refletido", novoNome, editado.json?.nome);

const gestorEdita = await req(gestora, "PATCH", `/admin/unidades/${medicoUnid.id}`, { nome: "Hack" });
caso("gestor não edita unidade (403)", 403, gestorEdita.status);

const editaInexistente = await req(admin, "PATCH", "/admin/unidades/cuid-inexistente-000", {
  nome: "Nome Válido Qualquer",
});
caso("editar unidade inexistente → 404", 404, editaInexistente.status);

const desativa = await req(admin, "PATCH", `/admin/unidades/${medicoUnid.id}/ativo`, { ativo: false });
caso("admin desativa unidade (200)", 200, desativa.status);
caso("unidade ficou inativa", false, desativa.json?.ativo);
const reativa = await req(admin, "PATCH", `/admin/unidades/${medicoUnid.id}/ativo`, { ativo: true });
caso("admin reativa unidade (200)", 200, reativa.status);
caso("unidade voltou ativa", true, reativa.json?.ativo);

// restaura o nome original para não contaminar outras validações
if (nomeOriginal) {
  await req(admin, "PATCH", `/admin/unidades/${medicoUnid.id}`, { nome: nomeOriginal });
}

// ============================================================
console.log("--- COMUNICADOS: entrega/leitura (SUPER_ADMIN only) ---");
const entrega = await req(admin, "GET", "/admin/comunicados/entrega");
caso("admin lê entrega de comunicados (200)", 200, entrega.status);
caso("gestor bloqueado na entrega (403)", 403, (await req(gestora, "GET", "/admin/comunicados/entrega")).status);
caso("família bloqueada na entrega (403)", 403, (await req(familia, "GET", "/admin/comunicados/entrega")).status);
ok("entrega devolve items (array)", Array.isArray(entrega.json?.items));
ok("entrega tem KPIs", typeof entrega.json?.kpis?.total === "number");
ok(
  "cada item traz cobertura coerente (lidos <= alvo, pct 0-100)",
  entrega.json?.items?.every(
    (i) =>
      i.lidos <= i.publicoAlvo &&
      i.coberturaPct >= 0 &&
      i.coberturaPct <= 100 &&
      i.pendentes === Math.max(0, i.publicoAlvo - i.lidos),
  ),
);

const entregaCriticos = await req(admin, "GET", "/admin/comunicados/entrega?criticos=true");
caso("filtro só críticos (200)", 200, entregaCriticos.status);
ok(
  "filtro retorna só comunicados críticos",
  entregaCriticos.json?.items?.every((i) => i.critico === true),
);

const total = resultados.length;
const okN = resultados.filter(Boolean).length;
console.log(`\n${okN}/${total}`);
if (okN !== total) process.exit(1);
console.log(">>> ADMIN / GOVERNANÇA LGPD VALIDADA <<<");
