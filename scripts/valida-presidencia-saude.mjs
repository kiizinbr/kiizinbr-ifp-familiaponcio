/**
 * E2E de Saúde Populacional (Presidência): RBAC (só PRESIDENCIA/SUPER_ADMIN),
 * forma da resposta agregada, ≥1 recorte real (seed: João tem condição "Asma"
 * + alergia "Dipirona"; Ana tem alergia "Amendoim") e INVARIANTES de anonimato
 * (nenhum nome/CPF/protocolo na saída — só contagens).
 * Uso: SENHA_DEV=... [SENHA_ADMIN=...] node scripts/valida-presidencia-saude.mjs
 *   SENHA_DEV   = SEED_MEDICO_PASSWORD (medico@/familia@ — perfis nao-admin)
 *   SENHA_ADMIN = SEED_SUPER_ADMIN_PASSWORD (admin@ifp.local; cai em SENHA_DEV se ausente)
 */
const API = process.env.API_URL_TESTE ?? "http://127.0.0.1:3333/api/v1";
const SENHA = process.env.SENHA_DEV;
const SENHA_ADMIN = process.env.SENHA_ADMIN ?? SENHA;
if (!SENHA) {
  console.error("Defina SENHA_DEV");
  process.exit(2);
}

async function login(email, senha = SENHA) {
  const r = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, senha }),
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
  console.log(`${ok ? "✓" : "✗ FALHOU"} ${nome}: ${JSON.stringify(obtido)} (espera ${JSON.stringify(esperado)})`);
}
function ok(nome, cond) {
  resultados.push(Boolean(cond));
  console.log(`${cond ? "✓" : "✗ FALHOU"} ${nome}`);
}
const soma = (arr, f) => arr.reduce((a, x) => a + f(x), 0);

const presidencia = await login("presidencia@ifp.local");
const admin = await login("admin@ifp.local", SENHA_ADMIN);
const medico = await login("medico@ifp.local");
const familia = await login("familia@ifp.local");

console.log("--- RBAC (gating da Saúde Populacional) ---");
caso("presidência lê saúde (200)", 200, (await req(presidencia, "GET", "/presidencia/saude")).status);
caso("super admin lê saúde (200)", 200, (await req(admin, "GET", "/presidencia/saude")).status);
caso("médico bloqueado (403)", 403, (await req(medico, "GET", "/presidencia/saude")).status);
caso("família bloqueada (403)", 403, (await req(familia, "GET", "/presidencia/saude")).status);

console.log("--- SAÚDE POPULACIONAL (forma + recortes reais) ---");
const sResp = await req(presidencia, "GET", "/presidencia/saude");
const s = sResp.json ?? {};
ok("tipo é saude-populacional", s.tipo === "saude-populacional");
ok("kpis presentes e numéricos", s.kpis && typeof s.kpis.condicoesAtivas === "number" && typeof s.kpis.pessoasSobCuidado === "number");
ok("faixaEtaria é array de 5 faixas", Array.isArray(s.faixaEtaria) && s.faixaEtaria.length === 5);
ok("porCondicao é array", Array.isArray(s.porCondicao));
ok("alergiasPorGravidade é array", Array.isArray(s.alergiasPorGravidade));
ok("triagensPorRisco é array", Array.isArray(s.triagensPorRisco));
ok("porCid10 é array", Array.isArray(s.porCid10));
ok("porBairro é array", Array.isArray(s.porBairro));

console.log("--- ≥1 RECORTE REAL (seed: Asma + alergias) ---");
ok("condicoesAtivas >= 1 (seed: Asma do João)", s.kpis.condicoesAtivas >= 1);
ok("alergiasAtivas >= 1 (seed: Dipirona/Amendoim)", s.kpis.alergiasAtivas >= 1);
ok("pessoasSobCuidado >= 1", s.kpis.pessoasSobCuidado >= 1);
ok("porCondicao tem >= 1 item real (Asma)", s.porCondicao.length >= 1 && s.porCondicao.some((c) => /asma/i.test(c.descricao)));
ok("condição Asma traz CID-10 J45 (seed)", s.porCondicao.some((c) => /asma/i.test(c.descricao) && c.cid10 === "J45"));
ok("alergiasPorGravidade tem >= 1 item", s.alergiasPorGravidade.length >= 1);

console.log("--- INVARIANTES de agregação ---");
ok("faixaEtaria soma == pessoasSobCuidado", soma(s.faixaEtaria, (f) => f.total) === s.kpis.pessoasSobCuidado);
ok("toda faixa tem total >= 0", s.faixaEtaria.every((f) => f.total >= 0));
ok("porCondicao no máx 8 itens (top)", s.porCondicao.length <= 8);
ok("porCid10 no máx 8 itens (top)", s.porCid10.length <= 8);
ok("alergias por gravidade usa rótulos válidos", s.alergiasPorGravidade.every((a) => ["GRAVE", "MODERADA", "LEVE", "Não classificada"].includes(a.gravidade) && a.total > 0));
ok("triagens por risco usa rótulos válidos", s.triagensPorRisco.every((t) => ["VERMELHO", "LARANJA", "AMARELO", "VERDE", "AZUL"].includes(t.risco) && t.total > 0));
ok("porBairro soma <= condicoes/alergias (1 família conta 1x)", soma(s.porBairro, (b) => b.total) <= s.kpis.condicoesAtivas + s.kpis.alergiasAtivas);

console.log("--- ANONIMATO (nunca dado individual) ---");
const bruto = JSON.stringify(s);
ok("sem campo 'nome' na resposta", !/"nome(Completo)?"\s*:/.test(bruto));
ok("sem campo 'cpf' na resposta", !/"cpf"\s*:/.test(bruto));
ok("sem campo 'protocolo' na resposta", !/"protocolo"\s*:/.test(bruto));
ok("sem campo 'fichaId'/'membroId' na resposta", !/"(ficha|membro)Id"\s*:/.test(bruto));

const total = resultados.length;
const okc = resultados.filter(Boolean).length;
console.log(`\n${okc}/${total}`);
if (okc !== total) process.exit(1);
console.log(">>> PRESIDÊNCIA / SAÚDE POPULACIONAL VALIDADA <<<");
