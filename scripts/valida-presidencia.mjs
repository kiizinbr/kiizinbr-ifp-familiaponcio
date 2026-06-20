/**
 * E2E da Sala de Comando (Presidência): RBAC (só PRESIDENCIA/SUPER_ADMIN),
 * forma das 5 respostas e INVARIANTES de agregação cross-unidade + fatos
 * conhecidos do seed (João/Maria em 3 unidades, Pedro em 2, Sandra em 1).
 * Uso: SENHA_DEV=... node scripts/valida-presidencia.mjs
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

async function reqRaw(token, path) {
  const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  return { status: r.status, contentType: r.headers.get("content-type") ?? "" };
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

const presidencia = await login("presidencia@ifp.local");
const admin = await login("admin@ifp.local");
const medico = await login("medico@ifp.local");
const familia = await login("familia@ifp.local");

console.log("--- RBAC (gating da Sala de Comando) ---");
caso("presidência lê resumo (200)", 200, (await req(presidencia, "GET", "/presidencia/resumo")).status);
caso("super admin lê resumo (200)", 200, (await req(admin, "GET", "/presidencia/resumo")).status);
caso("médico bloqueado (403)", 403, (await req(medico, "GET", "/presidencia/resumo")).status);
caso("família bloqueada (403)", 403, (await req(familia, "GET", "/presidencia/resumo")).status);
caso("família bloqueada na jornada (403)", 403, (await req(familia, "GET", "/presidencia/jornada")).status);

console.log("--- RESUMO ---");
const resumo = (await req(presidencia, "GET", "/presidencia/resumo")).json;
ok("resumo tem familiasAtivas numérico", typeof resumo.familiasAtivas === "number");
ok("resumo tem pessoasImpactadas numérico", typeof resumo.pessoasImpactadas === "number");
ok("familiasAtendidas <= familiasAtivas", resumo.familiasAtendidas <= resumo.familiasAtivas);
ok("pessoasImpactadas >= familiasAtivas", resumo.pessoasImpactadas >= resumo.familiasAtivas);
ok("unidadesAtivas >= 4 (os 4 salões)", resumo.unidadesAtivas >= 4);

console.log("--- FAMÍLIAS ---");
const fam = (await req(presidencia, "GET", "/presidencia/familias")).json;
caso("familias.total == resumo.familiasAtivas", resumo.familiasAtivas, fam.total);
ok("faixaEtaria soma == pessoasImpactadas", soma(fam.faixaEtaria, (f) => f.total) === fam.pessoasImpactadas);
ok("porBairro soma == total", soma(fam.porBairro, (b) => b.total) === fam.total);
ok("situacao.aprovadas == resumo.familiasAtendidas", fam.situacao.aprovadas === resumo.familiasAtendidas);
ok("perfilSocio.comDados >= 1 (seed enriquecido)", fam.perfilSocio.comDados >= 1);

console.log("--- UNIDADES ---");
const uni = (await req(presidencia, "GET", "/presidencia/unidades")).json;
ok("retorna 4 unidades", uni.unidades.length === 4);
ok(
  "ocupacaoMedia entre 0 e 100 (ou null)",
  uni.kpis.ocupacaoMedia === null || (uni.kpis.ocupacaoMedia >= 0 && uni.kpis.ocupacaoMedia <= 100),
);
const ocupacaoCoerente = uni.unidades
  .filter((u) => u.modo === "capacidade")
  .every((u) => u.ocupacaoPct === (u.vagas > 0 ? Math.round((u.ativos / u.vagas) * 100) : 0));
ok("ocupacaoPct = round(ativos/vagas) em cada unidade por capacidade", ocupacaoCoerente);
ok("médico aparece no modo volume", uni.unidades.some((u) => u.tipo === "MEDICO" && u.modo === "volume"));

console.log("--- IMPACTO ---");
const imp = (await req(presidencia, "GET", "/presidencia/impacto")).json;
ok("serieFamilias é array", Array.isArray(imp.serieFamilias));
ok("serieAtendimentos é array", Array.isArray(imp.serieAtendimentos));
ok("crescimentoPorUnidade é array", Array.isArray(imp.crescimentoPorUnidade));
ok("kpi familiasAtendidas == resumo", imp.kpis.familiasAtendidas === resumo.familiasAtendidas);

console.log("--- JORNADA (o diferencial) ---");
const jor = (await req(presidencia, "GET", "/presidencia/jornada")).json;
ok("familiasUnicas == soma da distribuição", jor.familiasUnicas === soma(jor.distribuicao, (d) => d.total));
const cross2 = soma(jor.distribuicao.filter((d) => d.unidades >= 2), (d) => d.total);
const cross3 = soma(jor.distribuicao.filter((d) => d.unidades >= 3), (d) => d.total);
ok("cross2mais consistente com a distribuição", jor.cross2mais === cross2);
ok("cross3mais consistente com a distribuição", jor.cross3mais === cross3);
ok("cross2mais >= 3 (seed: João, Maria, Pedro)", jor.cross2mais >= 3);
ok("cross3mais >= 2 (seed: João, Maria)", jor.cross3mais >= 2);
ok("há ao menos uma ponte entre unidades", jor.pontes.length >= 1);
ok("constelações anonimizadas (código #, sem nome)", jor.constelacoes.every((c) => /^#/.test(c.codigo) && !("nome" in c)));

console.log("--- PRESTAÇÃO DE CONTAS ---");
caso("família bloqueada na prestação (403)", 403, (await req(familia, "GET", "/presidencia/prestacao-contas")).status);
const pc = (await req(presidencia, "GET", "/presidencia/prestacao-contas?periodo=12m")).json;
ok("tem periodo/novas/realizados/base", Boolean(pc.periodo && pc.novas && pc.realizados && pc.base));
ok("periodo respeitado (12m)", pc.periodo.chave === "12m");
ok("base.familiasAtendidas == resumo.familiasAtendidas", pc.base.familiasAtendidas === resumo.familiasAtendidas);
ok("cross2maisPct entre 0 e 100", pc.base.cross2maisPct >= 0 && pc.base.cross2maisPct <= 100);
const pcMes = (await req(presidencia, "GET", "/presidencia/prestacao-contas?periodo=mes")).json;
ok("período mês <= 12m em novas famílias", pcMes.novas.familias <= pc.novas.familias);
const pdf = await reqRaw(presidencia, "/presidencia/prestacao-contas/pdf?periodo=12m");
caso("PDF responde 200", 200, pdf.status);
ok("PDF é application/pdf", pdf.contentType.includes("application/pdf"));

const total = resultados.length;
const okc = resultados.filter(Boolean).length;
console.log(`\n${okc}/${total}`);
if (okc !== total) process.exit(1);
console.log(">>> PRESIDÊNCIA / SALA DE COMANDO VALIDADA <<<");
