/**
 * E2E ao vivo dos Relatórios Institucionais Selados (B5 — Presidência).
 * Uso: SENHA_DEV=... node scripts/valida-presidencia-relatorios.mjs
 *
 * Cobre:
 *   - PRESIDENCIA gera relatório (POST) → 200 + registro com código/selo
 *   - lista (GET) traz o relatório recém-gerado pelo ID que eu criei
 *   - baixa o PDF (GET .../pdf) → 200 + content-type application/pdf
 *   - tipo IMPACTO também gera e baixa
 *   - SUPER_ADMIN (admin@) também acessa
 *   - RBAC: perfil comum (família) → 403 em listar/gerar/baixar
 *   - sem token → 401
 *   - baixar relatório inexistente → 404
 *   - auditoria EXPORT gravada (visível pelo admin no /admin/auditoria)
 *
 * Não conta total da lista (os valida acumulam): asserta sempre pelo ID gerado.
 */
const API = process.env.API_URL_TESTE ?? "http://127.0.0.1:3333/api/v1";
const SENHA = process.env.SENHA_DEV;
if (!SENHA) {
  console.error("Defina SENHA_DEV");
  process.exit(2);
}

async function loginComSenha(email, senha) {
  const r = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, senha }),
  });
  if (!r.ok) return null;
  const j = await r.json();
  return j.accessToken ?? j.access_token ?? j.token;
}

async function login(email) {
  const token = await loginComSenha(email, SENHA);
  if (token) return token;
  throw new Error(`login ${email} falhou`);
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
  let isPdf = false;
  const ct = r.headers.get("content-type") ?? "";
  if (ct.includes("application/pdf")) {
    isPdf = true;
  } else {
    try {
      json = await r.json();
    } catch {
      /* sem corpo */
    }
  }
  return { status: r.status, json, isPdf };
}

const resultados = [];
function caso(nome, esperado, obtido) {
  const ok = esperado === obtido;
  resultados.push(ok);
  console.log(`${ok ? "✓" : "✗ FALHOU"} ${nome}: ${obtido} (espera ${esperado})`);
}

// O admin pode ter senha própria (SEED_SUPER_ADMIN_PASSWORD) quando as senhas
// não foram padronizadas. Tenta SENHA_DEV e cai pra SENHA_ADMIN.
let admin = await loginComSenha("admin@ifp.local", SENHA);
if (!admin && process.env.SENHA_ADMIN) {
  admin = await loginComSenha("admin@ifp.local", process.env.SENHA_ADMIN);
}
if (!admin) {
  console.error("Não consegui logar como admin@ifp.local. Confira SENHA_DEV/SENHA_ADMIN.");
  process.exit(2);
}

const presidencia = await login("presidencia@ifp.local");
const familia = await login("familia@ifp.local");

console.log("--- GERAR (PRESIDÊNCIA) ---");
const gerada = await req(presidencia, "POST", "/presidencia/relatorios", {
  tipo: "PRESTACAO_CONTAS",
  periodo: "12m",
});
caso("presidência -> gera relatório", 201, gerada.status);
const relId = gerada.json?.id;
caso("geração retorna um id", true, Boolean(relId));
caso("geração retorna o tipo certo", "PRESTACAO_CONTAS", gerada.json?.tipo);
caso("geração retorna código de selo (IFP-...)", true, /^IFP-[A-Z0-9]{6}$/.test(gerada.json?.codigo ?? ""));
caso("geração registra quem gerou", true, Boolean(gerada.json?.geradoPorNome));

console.log("--- LISTAR (acha pelo ID gerado, não por contagem) ---");
const lista = await req(presidencia, "GET", "/presidencia/relatorios");
caso("presidência -> lista relatórios", 200, lista.status);
const naLista = (lista.json?.itens ?? []).find((r) => r.id === relId);
caso("lista contém o relatório recém-gerado", true, Boolean(naLista));
caso("item da lista traz o tipoLabel", true, naLista?.tipoLabel === "Prestação de Contas");
caso("item da lista traz o código selado", gerada.json?.codigo, naLista?.codigo);

console.log("--- BAIXAR PDF ---");
const pdf = await req(presidencia, "GET", `/presidencia/relatorios/${relId}/pdf`);
caso("presidência -> baixa o PDF", 200, pdf.status);
caso("o download é mesmo um PDF", true, pdf.isPdf);

const pdfInexistente = await req(presidencia, "GET", "/presidencia/relatorios/nao-existe/pdf");
caso("baixar relatório inexistente -> 404", 404, pdfInexistente.status);

console.log("--- TIPO IMPACTO ---");
const impacto = await req(presidencia, "POST", "/presidencia/relatorios", {
  tipo: "IMPACTO",
  periodo: "ano",
});
caso("presidência -> gera relatório de IMPACTO", 201, impacto.status);
caso("relatório de impacto tem o tipo certo", "IMPACTO", impacto.json?.tipo);
const pdfImpacto = await req(presidencia, "GET", `/presidencia/relatorios/${impacto.json?.id}/pdf`);
caso("presidência -> baixa PDF de impacto", 200, pdfImpacto.status);
caso("PDF de impacto é mesmo PDF", true, pdfImpacto.isPdf);

console.log("--- DEFAULTS (corpo vazio) ---");
const semCorpo = await req(presidencia, "POST", "/presidencia/relatorios", {});
caso("gera com corpo vazio (defaults)", 201, semCorpo.status);
caso("default de tipo = PRESTACAO_CONTAS", "PRESTACAO_CONTAS", semCorpo.json?.tipo);
caso("default de periodo = 12m", "12m", semCorpo.json?.periodo);

console.log("--- SUPER_ADMIN também acessa ---");
const adminGera = await req(admin, "POST", "/presidencia/relatorios", { tipo: "PRESTACAO_CONTAS", periodo: "mes" });
caso("admin -> gera relatório", 201, adminGera.status);
const adminLista = await req(admin, "GET", "/presidencia/relatorios");
caso("admin -> lista relatórios", 200, adminLista.status);

console.log("--- RBAC (perfil comum -> 403) ---");
const famGera = await req(familia, "POST", "/presidencia/relatorios", { tipo: "PRESTACAO_CONTAS" });
caso("família -> gerar (RBAC)", 403, famGera.status);
const famLista = await req(familia, "GET", "/presidencia/relatorios");
caso("família -> listar (RBAC)", 403, famLista.status);
const famPdf = await req(familia, "GET", `/presidencia/relatorios/${relId}/pdf`);
caso("família -> baixar PDF (RBAC)", 403, famPdf.status);

console.log("--- SEM TOKEN (401) ---");
const semTokenLista = await req(null, "GET", "/presidencia/relatorios");
caso("sem token -> listar (401)", 401, semTokenLista.status);
const semTokenGera = await req(null, "POST", "/presidencia/relatorios", { tipo: "IMPACTO" });
caso("sem token -> gerar (401)", 401, semTokenGera.status);

console.log("--- AUDITORIA EXPORT gravada (visível pelo admin) ---");
// A gravação do AuditLog é fire-and-forget (não bloqueia a resposta); dá uma
// folga curta + algumas tentativas para evitar corrida no assert.
async function buscarLogExport() {
  for (let i = 0; i < 8; i++) {
    const r = await req(
      admin,
      "GET",
      "/admin/auditoria?entidade=RelatorioPDF&acao=EXPORT&perPage=100",
    );
    const logs = r.json?.items ?? [];
    const achou = logs.some((l) => l.entidadeId === relId && l.acao === "EXPORT");
    if (achou) return { status: r.status, achou: true };
    await new Promise((res) => setTimeout(res, 250));
  }
  return { status: 200, achou: false };
}
const auditoria = await buscarLogExport();
caso("admin -> consulta auditoria", 200, auditoria.status);
caso("há log EXPORT do relatório gerado", true, auditoria.achou);

const total = resultados.length;
const ok = resultados.filter(Boolean).length;
console.log(`\n${ok}/${total}`);
if (ok !== total) process.exit(1);
console.log(">>> PRESIDÊNCIA · RELATÓRIOS SELADOS (PDF) VALIDADO <<<");
