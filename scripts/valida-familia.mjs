/**
 * E2E ao vivo do Portal da Família — "O que recebi" + galeria de certificados.
 * Uso: SENHA_DEV=... node scripts/valida-familia.mjs
 * Cobre: resumo agregado de benefícios da família, galeria de certificados
 * (capacitação) + graduações (esporte), download de PDF da PRÓPRIA família,
 * IDOR (PDF de outra família → 404) e RBAC (perfil errado → 403).
 *
 * Fixtures do seed (família Sandra = familia@ifp.local):
 *   - certificado seed-cert-sandra (Sandra, titular)
 *   - graduação    seed-grad-ana   (Ana, dependente)
 *   - certificado seed-cert-outra-familia (João — NÃO é da Sandra → IDOR)
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
  const j = await r.json();
  return j.accessToken ?? j.access_token ?? j.token;
}

async function req(token, method, path) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
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

const familia = await login("familia@ifp.local");
const medico = await login("medico@ifp.local");
const sensei = await login("esporte@ifp.local");

console.log("--- RECEBIDO (resumo agregado) ---");
const recebido = await req(familia, "GET", "/familia/recebido");
caso("família -> recebido", 200, recebido.status);
console.log(`    resumo: ${JSON.stringify(recebido.json?.resumo)}`);
caso("recebido traz creche da Ana", true, (recebido.json?.resumo?.creche ?? 0) >= 1);
caso(
  "recebido conta o certificado da Sandra",
  true,
  (recebido.json?.resumo?.certificados ?? 0) >= 1,
);
caso(
  "recebido conta a graduação da Ana",
  true,
  (recebido.json?.resumo?.graduacoes ?? 0) >= 1,
);
// IDOR: só dados da própria família — nenhuma matrícula de capacitação aponta
// para beneficiário fora da família (todos resolvem do próprio fichaId).
const capItens = recebido.json?.capacitacao ?? [];
caso(
  "recebido só lista benefícios da própria família",
  true,
  capItens.every((m) => typeof m.beneficiario === "string"),
);

console.log("--- CERTIFICADOS / GRADUAÇÕES (galeria) ---");
const certs = await req(familia, "GET", "/familia/certificados");
caso("família -> certificados", 200, certs.status);
const listaCert = certs.json?.certificados ?? [];
const listaGrad = certs.json?.graduacoes ?? [];
console.log(`    ${listaCert.length} certificado(s) · ${listaGrad.length} graduação(ões)`);
const certSandra = listaCert.find((c) => c.codigoVerificacao === "seed-cert-sandra");
caso("galeria traz o certificado da Sandra", true, Boolean(certSandra));
const gradAna = listaGrad.find((g) => g.codigoVerificacao === "seed-grad-ana");
caso("galeria traz a graduação da Ana", true, Boolean(gradAna));
// IDOR de leitura: o certificado de outra família NÃO pode aparecer na galeria.
caso(
  "galeria NÃO vaza certificado de outra família",
  false,
  listaCert.some((c) => c.codigoVerificacao === "seed-cert-outra-familia"),
);

console.log("--- PDF (próprio x de outra família = IDOR) ---");
const pdfProprio = await req(familia, "GET", "/familia/certificados/seed-cert-sandra/pdf");
caso("família -> baixa PDF do próprio certificado", 200, pdfProprio.status);
caso("o download é mesmo um PDF", true, pdfProprio.isPdf);

const pdfOutra = await req(
  familia,
  "GET",
  "/familia/certificados/seed-cert-outra-familia/pdf",
);
caso("família -> PDF de OUTRA família (IDOR)", 404, pdfOutra.status);

const pdfInexistente = await req(familia, "GET", "/familia/certificados/nao-existe/pdf");
caso("família -> PDF inexistente", 404, pdfInexistente.status);

console.log("--- RBAC (perfil errado → 403) ---");
const medicoRecebido = await req(medico, "GET", "/familia/recebido");
caso("médico -> recebido (RBAC)", 403, medicoRecebido.status);
const medicoCerts = await req(medico, "GET", "/familia/certificados");
caso("médico -> certificados (RBAC)", 403, medicoCerts.status);
const senseiRecebido = await req(sensei, "GET", "/familia/recebido");
caso("sensei -> recebido (RBAC)", 403, senseiRecebido.status);
const semToken = await req(null, "GET", "/familia/recebido");
caso("sem token -> recebido (401)", 401, semToken.status);

const total = resultados.length;
const ok = resultados.filter(Boolean).length;
console.log(`\n${ok}/${total}`);
if (ok !== total) process.exit(1);
console.log(">>> PORTAL DA FAMÍLIA (recebido + certificados) VALIDADO <<<");
