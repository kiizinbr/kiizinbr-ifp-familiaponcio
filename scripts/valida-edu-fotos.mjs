/**
 * E2E ao vivo das FOTOS DO DIÁRIO DA CRECHE (Onda C3 — storage + LGPD afetivo):
 *  - educadora anexa foto (multipart) ao diário do dia da Ana → 201 (sem expor
 *    a chave do storage);
 *  - validação: MIME não-imagem → 415; sem arquivo → 400;
 *  - família (Sandra) NÃO vê foto enquanto o diário está ABERTO (selo);
 *  - educadora fecha o diário → família passa a VER (lista + download presigned);
 *  - educadora NÃO anexa/lista foto após o selo → 409 (diário imutável);
 *  - TENANT educadora: criança fora da unidade (Caio? na verdade Caio está na
 *    turma) — usamos o caminho de download de OUTRA unidade (404);
 *  - IDOR FAMÍLIA-vs-FAMÍLIA: a educadora sobe e fecha foto do Caio (família do
 *    João); a Sandra (mãe da Ana) NÃO lista nem baixa a foto do Caio (lista
 *    vazia / download 404). A Beatriz (mãe do Caio) VÊ a foto do Caio;
 *  - RBAC: médico (perfil errado) → 403; sem token → 401.
 *
 * Pré-requisito: MinIO no ar (Docker :9000), API com MINIO_* no .env, seed aplicado.
 *
 * Uso: SENHA_DEV=... node scripts/valida-edu-fotos.mjs
 */
const API = process.env.API_URL_TESTE ?? "http://127.0.0.1:3333/api/v1";
const SENHA = process.env.SENHA_DEV;
if (!SENHA) {
  console.error("Defina SENHA_DEV");
  process.exit(2);
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(email, senha = SENHA) {
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

/** Upload multipart de uma foto (Buffer) ao diário de uma criança. */
async function uploadFoto(token, membroId, { nome, mime, conteudo, legenda }) {
  const form = new FormData();
  if (conteudo !== undefined) {
    form.append("arquivo", new Blob([conteudo], { type: mime }), nome);
  }
  if (legenda !== undefined) form.append("legenda", legenda);
  const r = await fetch(`${API}/educacional/diarios/${membroId}/fotos`, {
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

// Um JPEG mínimo válido o suficiente (header) — o MIME é o que vale na validação.
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

// ── logins ───────────────────────────────────────────────────────────
const educadora = await login("educadora@ifp.local");
const familia = await login("familia@ifp.local"); // Sandra (mãe da Ana)
const familia2 = await login("familia2@ifp.local"); // Beatriz (mãe do Caio)
const medico = await login("medico@ifp.local"); // PROFISSIONAL (RBAC)

// ── descobre os membroIds via API (não confia em id do client) ──────────
// Ana: 1ª matrícula da turma Jardim A no console da educadora.
const turmas = await req(educadora, "GET", "/educacional/turmas");
const turma = turmas.json?.items?.[0];
if (!turma) throw new Error("Jardim A não encontrado — rode o seed");
const detalhe = await req(educadora, "GET", `/educacional/turmas/${turma.id}`);
const matriculas = detalhe.json?.matriculas ?? [];
const anaMat = matriculas.find((m) => /ana/i.test(m.crianca?.nomeCompleto));
const caioMat = matriculas.find((m) => /caio/i.test(m.crianca?.nomeCompleto));
const anaId = anaMat?.membroId;
const caioId = caioMat?.membroId;
ok("achou a Ana na turma", Boolean(anaId));
ok("achou o Caio na turma (fixture IDOR)", Boolean(caioId));

// ============================================================
console.log("--- UPLOAD (educadora anexa foto ao diário da Ana) ---");
const up = await uploadFoto(educadora, anaId, {
  nome: "pintura.jpg",
  mime: "image/jpeg",
  conteudo: jpeg,
  legenda: "Primeira pintura a dedo!",
});
caso("educadora anexa foto → 201", 201, up.status);
ok("resposta traz id da foto", typeof up.json?.id === "string");
ok("resposta NÃO expõe a chave do storage (url)", up.json?.url === undefined);
caso("legenda gravada", "Primeira pintura a dedo!", up.json?.legenda);
const fotoAnaId = up.json?.id;

// ============================================================
console.log("--- VALIDAÇÃO (MIME / arquivo) ---");
const upPdf = await uploadFoto(educadora, anaId, {
  nome: "doc.pdf",
  mime: "application/pdf",
  conteudo: Buffer.from("%PDF-1.4", "utf-8"),
});
caso("MIME não-imagem (PDF) → 415", 415, upPdf.status);
const upSemArquivo = await uploadFoto(educadora, anaId, { legenda: "sem foto" });
caso("sem arquivo → 400", 400, upSemArquivo.status);

// ============================================================
console.log("--- SELO: família NÃO vê antes de fechar o diário ---");
const listaAberta = await req(familia, "GET", `/familia/educacional/diario/${anaId}/fotos`);
caso("família lista fotos (diário aberto) → 200", 200, listaAberta.status);
caso("  -> lista vem vazia antes do selo", 0, listaAberta.json?.items?.length ?? -1);
// download da foto antes do selo → 404 (não fechado ainda)
const dlAntesSelo = await req(
  familia,
  "GET",
  `/familia/educacional/diario/fotos/${fotoAnaId}/download`,
);
caso("família baixa foto antes do selo → 404", 404, dlAntesSelo.status);

// educadora também enxerga a foto no console (diário aberto)
const listaEdu = await req(educadora, "GET", `/educacional/diarios/${anaId}/fotos`);
caso("educadora lista fotos do dia → 200", 200, listaEdu.status);
ok("educadora vê a foto recém-enviada", listaEdu.json?.items?.some?.((f) => f.id === fotoAnaId));

// ============================================================
console.log("--- FECHAR DIÁRIO da Ana → família passa a ver ---");
// precisa de ao menos 1 registro p/ fechar (regra do diário); lança um.
await req(educadora, "POST", `/educacional/diarios/${anaId}/registros`, {
  tipo: "ATIVIDADE",
  descricao: "Pintura a dedo",
});
const diarioEdu = await req(educadora, "GET", `/educacional/diarios/${anaId}`);
const diarioAnaId = diarioEdu.json?.diario?.id;
const fechar = await req(educadora, "PATCH", `/educacional/diarios/${diarioAnaId}/fechar`);
caso("educadora fecha o diário → 200", 200, fechar.status);

// foto após o selo é bloqueada (diário imutável)
const upPosSelo = await uploadFoto(educadora, anaId, {
  nome: "tarde.jpg",
  mime: "image/jpeg",
  conteudo: jpeg,
});
caso("anexar foto após o selo → 409", 409, upPosSelo.status);

// família agora VÊ a foto
const listaFechada = await req(familia, "GET", `/familia/educacional/diario/${anaId}/fotos`);
caso("família lista fotos (diário fechado) → 200", 200, listaFechada.status);
ok("  -> a foto da Ana aparece para a família", listaFechada.json?.items?.some?.((f) => f.id === fotoAnaId));
ok("  -> a lista da família não expõe a chave do storage", listaFechada.json?.items?.every?.((f) => f.url === undefined));

const dl = await req(familia, "GET", `/familia/educacional/diario/fotos/${fotoAnaId}/download`);
caso("família baixa a foto (presigned) → 200", 200, dl.status);
ok("download devolve URL pré-assinada", typeof dl.json?.url === "string" && dl.json.url.startsWith("http"));
if (typeof dl.json?.url === "string") {
  const fetched = await fetch(dl.json.url);
  ok("URL pré-assinada baixa o arquivo (200)", fetched.status === 200);
}

// ============================================================
console.log("--- IDOR FAMÍLIA-vs-FAMÍLIA (foto do Caio) ---");
// A educadora sobe e fecha a foto do Caio (outra família, mesma turma).
const upCaio = await uploadFoto(educadora, caioId, {
  nome: "caio.jpg",
  mime: "image/jpeg",
  conteudo: jpeg,
  legenda: "Caio no parquinho",
});
caso("educadora anexa foto do Caio → 201", 201, upCaio.status);
const fotoCaioId = upCaio.json?.id;
await req(educadora, "POST", `/educacional/diarios/${caioId}/registros`, {
  tipo: "ATIVIDADE",
  descricao: "Parquinho",
});
const diarioCaioEdu = await req(educadora, "GET", `/educacional/diarios/${caioId}`);
await req(educadora, "PATCH", `/educacional/diarios/${diarioCaioEdu.json?.diario?.id}/fechar`);

// A SANDRA (mãe da Ana) NÃO vê nem baixa a foto do Caio.
const sandraVerCaio = await req(familia, "GET", `/familia/educacional/diario/${caioId}/fotos`);
caso("Sandra lista fotos do Caio (criança de outra família) → 403", 403, sandraVerCaio.status);
const sandraBaixarCaio = await req(
  familia,
  "GET",
  `/familia/educacional/diario/fotos/${fotoCaioId}/download`,
);
caso("Sandra baixa a foto do Caio (IDOR) → 404", 404, sandraBaixarCaio.status);

// A BEATRIZ (mãe do Caio) VÊ a foto do Caio (controle positivo do ownership).
const beatrizVerCaio = await req(familia2, "GET", `/familia/educacional/diario/${caioId}/fotos`);
caso("Beatriz lista fotos do Caio → 200", 200, beatrizVerCaio.status);
ok("  -> Beatriz vê a foto do próprio filho", beatrizVerCaio.json?.items?.some?.((f) => f.id === fotoCaioId));
const beatrizBaixarCaio = await req(
  familia2,
  "GET",
  `/familia/educacional/diario/fotos/${fotoCaioId}/download`,
);
caso("Beatriz baixa a foto do Caio (presigned) → 200", 200, beatrizBaixarCaio.status);
// E a Beatriz NÃO baixa a foto da Ana (IDOR no sentido inverso).
const beatrizBaixarAna = await req(
  familia2,
  "GET",
  `/familia/educacional/diario/fotos/${fotoAnaId}/download`,
);
caso("Beatriz baixa a foto da Ana (IDOR) → 404", 404, beatrizBaixarAna.status);

// ============================================================
console.log("--- RBAC / sem token ---");
caso(
  "médico (perfil errado) anexa foto → 403",
  403,
  (await uploadFoto(medico, anaId, { nome: "x.jpg", mime: "image/jpeg", conteudo: jpeg })).status,
);
caso(
  "médico lista fotos da família → 403",
  403,
  (await req(medico, "GET", `/familia/educacional/diario/${anaId}/fotos`)).status,
);
caso(
  "sem token lista fotos da família → 401",
  401,
  (await req(null, "GET", `/familia/educacional/diario/${anaId}/fotos`)).status,
);
caso(
  "sem token anexa foto → 401",
  401,
  (await uploadFoto("", anaId, { nome: "x.jpg", mime: "image/jpeg", conteudo: jpeg })).status,
);

const total = resultados.length;
const okN = resultados.filter(Boolean).length;
console.log(`\n${okN}/${total}`);
if (okN !== total) process.exit(1);
console.log(">>> FOTOS DO DIÁRIO DA CRECHE (C3) VALIDADO <<<");
