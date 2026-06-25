/**
 * E2E ao vivo dos DOCUMENTOS DA FICHA CIDADÃ (Onda C2 — storage + LGPD):
 *  - upload (multipart) → 201 + linha Documento (sem expor a chave do storage);
 *  - lista da ficha;
 *  - download → URL pré-assinada (checa ownership/tenant antes);
 *  - IDOR cross-ficha: docId de UMA ficha via OUTRA ficha → 404;
 *  - RBAC/tenant: profissional de unidade / família / gestor → 403;
 *  - validação: MIME proibido → 415; sem tipo → 400;
 *  - delete → some da lista; baixar de novo → 404.
 *
 * Pré-requisito: MinIO no ar (Docker :9000), API com MINIO_* no .env, seed aplicado.
 *
 * Uso: SENHA_ADMIN=... SENHA_DEV=... node scripts/valida-documentos-ficha.mjs
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

async function req(token, method, path) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
  });
  let json = null;
  try {
    json = await r.json();
  } catch {
    /* sem corpo */
  }
  return { status: r.status, json };
}

/** Upload multipart de um Buffer como arquivo. */
async function upload(token, fichaId, { tipo, nome, mime, conteudo }) {
  const form = new FormData();
  if (tipo !== undefined) form.append("tipo", tipo);
  if (conteudo !== undefined) {
    form.append("arquivo", new Blob([conteudo], { type: mime }), nome);
  }
  const r = await fetch(`${API}/fichas-cidadas/${fichaId}/documentos`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
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

// ── logins ───────────────────────────────────────────────────────────
// Caminho feliz: admin (SUPER_ADMIN, um dos 2 perfis permitidos na ficha).
// Os demais perfis (profissional/família/gestor) devem cair em 403 — é a
// parede de tenant/RBAC no controller. (O persona SERVICO_SOCIAL do seed usa
// uma senha à parte e não é loginável aqui; o portão é o mesmo do admin.)
const admin = await login("admin@ifp.local", SENHA_ADMIN);
const medico = await login("medico@ifp.local", SENHA_DEV); // PROFISSIONAL (bloqueado)
const familia = await login("familia@ifp.local", SENHA_DEV); // RESPONSAVEL_FAMILIAR (bloqueado)
const gestora = await login("gestora@ifp.local", SENHA_DEV); // GESTOR_UNIDADE (bloqueado)

// ── duas fichas distintas para o teste de IDOR cross-ficha ───────────
const lista = await req(admin, "GET", "/fichas-cidadas");
if (!lista.json?.items || lista.json.items.length < 2) {
  console.error("Precisa de pelo menos 2 fichas no seed para o teste de IDOR.");
  process.exit(2);
}
const fichaA = lista.json.items[0].id;
const fichaB = lista.json.items[1].id;

const pdf = Buffer.from("%PDF-1.4\n%fake pdf para teste C2\n", "utf-8");
// PNG real (assinatura de 8 bytes — basta para o file-type reconhecer image/png).
const png = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // \x89PNG\r\n\x1a\n
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR
]);

// ============================================================
console.log("--- UPLOAD (caminho feliz) ---");
const up = await upload(admin, fichaA, {
  tipo: "COMPROVANTE_RENDA",
  nome: "comprovante.pdf",
  mime: "application/pdf",
  conteudo: pdf,
});
caso("admin sobe documento → 201", 201, up.status);
ok("resposta traz id do documento", typeof up.json?.id === "string");
ok("resposta NÃO expõe a chave do storage (url)", up.json?.url === undefined);
caso("tipo gravado", "COMPROVANTE_RENDA", up.json?.tipo);
const docId = up.json?.id;

// segundo upload (imagem PNG REAL) — confirma que outro MIME permitido passa
const upPng = await upload(admin, fichaA, {
  tipo: "RG",
  nome: "rg.png",
  mime: "image/png",
  conteudo: png,
});
caso("admin sobe imagem PNG → 201", 201, upPng.status);

// ============================================================
console.log("--- VALIDAÇÃO (MIME/tipo) ---");
const upBad = await upload(admin, fichaA, {
  tipo: "OUTRO",
  nome: "virus.exe",
  mime: "application/x-msdownload",
  conteudo: Buffer.from("MZ", "utf-8"),
});
caso("MIME não permitido → 415", 415, upBad.status);

// MAGIC BYTES (P1.4): extensão/Content-Type de imagem, mas BYTES de outra coisa.
// Texto puro disfarçado de PNG: o Content-Type mente, os magic bytes não.
// No código antigo (que confiava no Content-Type) isso passava como 201.
const upDisfarcado = await upload(admin, fichaA, {
  tipo: "OUTRO",
  nome: "imagem.png",
  mime: "image/png",
  conteudo: Buffer.from("isto e texto puro, nao e uma imagem de verdade\n", "utf-8"),
});
caso("PNG falso (bytes de texto) → 415", 415, upDisfarcado.status);

// HTML disfarçado de JPEG (vetor de XSS via presigned URL) → 415.
const upHtml = await upload(admin, fichaA, {
  tipo: "OUTRO",
  nome: "foto.jpg",
  mime: "image/jpeg",
  conteudo: Buffer.from("<html><script>alert(1)</script></html>", "utf-8"),
});
caso("HTML disfarçado de JPEG → 415", 415, upHtml.status);

const upSemTipo = await upload(admin, fichaA, {
  nome: "doc.pdf",
  mime: "application/pdf",
  conteudo: pdf,
});
caso("sem campo 'tipo' → 400", 400, upSemTipo.status);

const upSemArquivo = await upload(admin, fichaA, { tipo: "OUTRO" });
caso("sem arquivo → 400", 400, upSemArquivo.status);

// ============================================================
console.log("--- LISTA ---");
const listaDocs = await req(admin, "GET", `/fichas-cidadas/${fichaA}/documentos`);
caso("lista documentos → 200", 200, listaDocs.status);
ok("documento recém-criado aparece na lista", listaDocs.json?.some?.((d) => d.id === docId));
ok("lista não expõe a chave do storage", listaDocs.json?.every?.((d) => d.url === undefined));

// ============================================================
console.log("--- DOWNLOAD (presigned, com ownership) ---");
const dl = await req(admin, "GET", `/fichas-cidadas/${fichaA}/documentos/${docId}`);
caso("download → 200", 200, dl.status);
ok("download devolve URL pré-assinada", typeof dl.json?.url === "string" && dl.json.url.startsWith("http"));
// a presigned tem que servir o conteúdo real
if (typeof dl.json?.url === "string") {
  const fetched = await fetch(dl.json.url);
  ok("URL pré-assinada baixa o arquivo (200)", fetched.status === 200);
}

// ============================================================
console.log("--- IDOR cross-ficha (docId de A via ficha B → 404) ---");
caso(
  "baixar doc da ficha A pelo caminho da ficha B → 404",
  404,
  (await req(admin, "GET", `/fichas-cidadas/${fichaB}/documentos/${docId}`)).status,
);
caso(
  "excluir doc da ficha A pelo caminho da ficha B → 404",
  404,
  (await req(admin, "DELETE", `/fichas-cidadas/${fichaB}/documentos/${docId}`)).status,
);

// ============================================================
console.log("--- RBAC / parede de tenant (perfis sem acesso à ficha → 403) ---");
caso("profissional (médico) lista → 403", 403, (await req(medico, "GET", `/fichas-cidadas/${fichaA}/documentos`)).status);
caso("profissional (médico) baixa → 403", 403, (await req(medico, "GET", `/fichas-cidadas/${fichaA}/documentos/${docId}`)).status);
const upMedico = await upload(medico, fichaA, {
  tipo: "OUTRO",
  nome: "x.pdf",
  mime: "application/pdf",
  conteudo: pdf,
});
caso("profissional (médico) sobe → 403", 403, upMedico.status);
caso("família lista → 403", 403, (await req(familia, "GET", `/fichas-cidadas/${fichaA}/documentos`)).status);
caso("gestor de unidade lista → 403", 403, (await req(gestora, "GET", `/fichas-cidadas/${fichaA}/documentos`)).status);

// ============================================================
console.log("--- DELETE ---");
caso("admin exclui documento → 200", 200, (await req(admin, "DELETE", `/fichas-cidadas/${fichaA}/documentos/${docId}`)).status);
caso("baixar documento excluído → 404", 404, (await req(admin, "GET", `/fichas-cidadas/${fichaA}/documentos/${docId}`)).status);
const listaPos = await req(admin, "GET", `/fichas-cidadas/${fichaA}/documentos`);
ok("documento excluído sumiu da lista", !listaPos.json?.some?.((d) => d.id === docId));

const total = resultados.length;
const okN = resultados.filter(Boolean).length;
console.log(`\n${okN}/${total}`);
if (okN !== total) process.exit(1);
console.log(">>> DOCUMENTOS DA FICHA (C2) VALIDADO <<<");
