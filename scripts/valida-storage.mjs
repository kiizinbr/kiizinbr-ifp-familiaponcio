/**
 * E2E ao vivo da FUNDAÇÃO DE STORAGE (Onda C1):
 *  - GET /admin/storage/health: SUPER_ADMIN faz round-trip real no MinIO → 200 {ok:true}.
 *  - RBAC: perfis comuns (gestor/família/médico) → 403.
 *
 * Pré-requisito: MinIO no ar (Docker :9000) e API com as MINIO_* no .env.
 *
 * Uso: SENHA_ADMIN=... SENHA_DEV=... node scripts/valida-storage.mjs
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
console.log("--- HEALTH: round-trip no MinIO (SUPER_ADMIN) ---");
const h = await req(admin, "GET", "/admin/storage/health");
caso("admin: health 200", 200, h.status);
ok("resposta traz ok:true", h.json?.ok === true);
ok("resposta traz o nome do bucket", typeof h.json?.bucket === "string" && h.json.bucket.length > 0);

// ============================================================
console.log("--- RBAC: /admin/storage/health (SUPER_ADMIN only) ---");
caso("gestor de unidade bloqueado (403)", 403, (await req(gestora, "GET", "/admin/storage/health")).status);
caso("família bloqueada (403)", 403, (await req(familia, "GET", "/admin/storage/health")).status);
caso("profissional médico bloqueado (403)", 403, (await req(medico, "GET", "/admin/storage/health")).status);

const total = resultados.length;
const okN = resultados.filter(Boolean).length;
console.log(`\n${okN}/${total}`);
if (okN !== total) process.exit(1);
console.log(">>> FUNDAÇÃO DE STORAGE (C1) VALIDADA <<<");
