/**
 * E2E do Impacto Longitudinal (C3 — Presidência): séries temporais por mês
 * cruzando as verticais. Cobre RBAC (só PRESIDENCIA/SUPER_ADMIN), forma da
 * resposta, coerência da grade de meses (generate_series preenche vazios),
 * o clamp de `meses` (3..24) e a invariante "KPI == soma da série".
 * Uso: SENHA_DEV=... node scripts/valida-presidencia-impacto.mjs
 */
// API_URL (do helper) vem sem /api/v1; só o usamos como base do host se existir.
const BASE = process.env.API_URL_TESTE ?? (process.env.API_URL ? `${process.env.API_URL}/api/v1` : "http://127.0.0.1:3333/api/v1");
const API = BASE;
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

async function req(token, method, path) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const r = await fetch(`${API}${path}`, { method, headers });
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
function ok(nome, cond) {
  resultados.push(Boolean(cond));
  console.log(`${cond ? "✓" : "✗ FALHOU"} ${nome}`);
}
const soma = (arr, f) => arr.reduce((a, x) => a + f(x), 0);

// admin pode ter senha própria (SEED_SUPER_ADMIN_PASSWORD)
let admin = await loginComSenha("admin@ifp.local", SENHA);
if (!admin && process.env.SENHA_ADMIN) {
  admin = await loginComSenha("admin@ifp.local", process.env.SENHA_ADMIN);
}
if (!admin) {
  console.error("Não consegui logar como admin@ifp.local. Confira SENHA_DEV/SENHA_ADMIN.");
  process.exit(2);
}

const presidencia = await login("presidencia@ifp.local");
const medico = await login("medico@ifp.local");
const familia = await login("familia@ifp.local");

console.log("--- RBAC (séries são da Sala de Comando) ---");
caso("presidência lê séries (200)", 200, (await req(presidencia, "GET", "/presidencia/impacto-series")).status);
caso("super admin lê séries (200)", 200, (await req(admin, "GET", "/presidencia/impacto-series")).status);
caso("médico bloqueado (403)", 403, (await req(medico, "GET", "/presidencia/impacto-series")).status);
caso("família bloqueada (403)", 403, (await req(familia, "GET", "/presidencia/impacto-series")).status);
caso("sem token (401)", 401, (await req(null, "GET", "/presidencia/impacto-series")).status);

console.log("--- FORMA E INVARIANTES (default 12 meses) ---");
const d = (await req(presidencia, "GET", "/presidencia/impacto-series")).json;
caso("default = 12 meses", 12, d.meses);
ok("tem objeto kpis", d.kpis && typeof d.kpis === "object");
ok("series é array", Array.isArray(d.series));
caso("são 5 séries (atend./matr./grad./cert./pres.)", 5, d.series.length);

const chavesEsperadas = ["atendimentos", "matriculas", "graduacoes", "certificados", "presencas"];
ok(
  "as 5 chaves esperadas estão presentes",
  chavesEsperadas.every((c) => d.series.some((s) => s.chave === c)),
);

let todasShapeOk = true;
let todasGradeOk = true;
let todasNaoNegativas = true;
let todosKpisBatem = true;
for (const serie of d.series) {
  const pontos = serie.pontos;
  if (!Array.isArray(pontos) || typeof serie.label !== "string") todasShapeOk = false;
  // generate_series garante exatamente `meses` pontos (preenche vazios com zero)
  if (!Array.isArray(pontos) || pontos.length !== d.meses) todasGradeOk = false;
  if (
    !Array.isArray(pontos) ||
    !pontos.every((p) => /^\d{4}-\d{2}$/.test(p.mes) && Number.isInteger(p.total) && p.total >= 0)
  ) {
    todasNaoNegativas = false;
  }
  // KPI do topo == soma da própria série (coerência número grande × gráfico)
  const somaSerie = Array.isArray(pontos) ? soma(pontos, (p) => p.total) : -1;
  if (d.kpis[serie.chave] !== somaSerie) todosKpisBatem = false;
}
ok("toda série tem label + pontos[]", todasShapeOk);
ok("toda série tem exatamente `meses` pontos (grade preenchida)", todasGradeOk);
ok("todo ponto é YYYY-MM com total inteiro >= 0", todasNaoNegativas);
ok("cada KPI == soma da respectiva série", todosKpisBatem);

console.log("--- CLAMP DE MESES (3..24) ---");
const seis = (await req(presidencia, "GET", "/presidencia/impacto-series?meses=6")).json;
caso("meses=6 respeitado", 6, seis.meses);
ok("séries de 6m têm 6 pontos cada", seis.series.every((s) => s.pontos.length === 6));

const baixo = (await req(presidencia, "GET", "/presidencia/impacto-series?meses=1")).json;
caso("meses=1 sobe para o mínimo 3", 3, baixo.meses);

const alto = (await req(presidencia, "GET", "/presidencia/impacto-series?meses=99")).json;
caso("meses=99 desce para o máximo 24", 24, alto.meses);

const lixo = (await req(presidencia, "GET", "/presidencia/impacto-series?meses=abc")).json;
caso("meses inválido cai no default 12", 12, lixo.meses);

console.log("--- DADO REAL (o seed gera atendimentos/matrículas) ---");
const atend = d.series.find((s) => s.chave === "atendimentos");
const matr = d.series.find((s) => s.chave === "matriculas");
ok("há pelo menos 1 atendimento OU 1 matrícula no histórico (seed)", (atend?.pontos.some((p) => p.total > 0) || matr?.pontos.some((p) => p.total > 0)) === true);

const total = resultados.length;
const okc = resultados.filter(Boolean).length;
console.log(`\n${okc}/${total}`);
if (okc !== total) process.exit(1);
console.log(">>> PRESIDÊNCIA · IMPACTO LONGITUDINAL (SÉRIES) VALIDADO <<<");
