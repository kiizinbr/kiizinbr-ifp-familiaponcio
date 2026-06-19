/**
 * E2E de beneficiários, ficha clínica (alergias/condições) e prontuários do
 * Centro Médico (Bloco D).
 * Uso: SENHA_DEV=... node scripts/valida-medico-beneficiarios.mjs
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

const resultados = [];
function caso(nome, esperado, obtido) {
  const ok = esperado === obtido;
  resultados.push(ok);
  console.log(`${ok ? "✓" : "✗ FALHOU"} ${nome}: ${obtido} (espera ${esperado})`);
}

const medico = await login("medico@ifp.local");
const familia = await login("familia@ifp.local");
const marca = Date.now().toString(36);

console.log("--- LISTAGEM ---");
const lista = await req(medico, "GET", "/medico/beneficiarios");
caso("lista beneficiários", 200, lista.status);
const fichaId = lista.json?.items?.[0]?.id;
if (!fichaId) {
  console.error("Nenhum beneficiário elegível — rode o seed.");
  process.exit(2);
}

console.log("--- FICHA CLÍNICA ---");
const fc = await req(medico, "GET", `/medico/beneficiarios/${fichaId}`);
caso("abre ficha clínica", 200, fc.status);
caso("ficha tem alergias[]", true, Array.isArray(fc.json?.alergias));
caso("ficha tem atendimentos[]", true, Array.isArray(fc.json?.atendimentos));

console.log("--- ALERGIAS ---");
const al = await req(medico, "POST", `/medico/beneficiarios/${fichaId}/alergias`, {
  descricao: `QA Alergia ${marca}`,
  gravidade: "GRAVE",
});
caso("registra alergia", 201, al.status);
const alergiaId = al.json?.id;
const fc2 = await req(medico, "GET", `/medico/beneficiarios/${fichaId}`);
caso(
  "alergia aparece na ficha (ativa)",
  true,
  Boolean(fc2.json?.alergias?.some((a) => a.id === alergiaId && a.ativa)),
);
const inat = await req(medico, "PATCH", `/medico/alergias/${alergiaId}`, { ativa: false });
caso("inativa alergia", 200, inat.status);
caso("alergia fica inativa", false, inat.json?.ativa);

console.log("--- CONDIÇÕES ---");
const co = await req(medico, "POST", `/medico/beneficiarios/${fichaId}/condicoes`, {
  descricao: `QA Condição ${marca}`,
  cid10: "I10",
});
caso("registra condição", 201, co.status);
const condId = co.json?.id;
const inatC = await req(medico, "PATCH", `/medico/condicoes/${condId}`, { ativa: false });
caso("inativa condição", 200, inatC.status);

console.log("--- PRONTUÁRIOS ---");
const pront = await req(medico, "GET", "/medico/prontuarios");
caso("lista prontuários", 200, pront.status);
caso("prontuários têm items[]", true, Array.isArray(pront.json?.items));

console.log("--- TENANT / RBAC ---");
const inexist = await req(medico, "GET", "/medico/beneficiarios/ficha-inexistente-xyz");
caso("ficha inexistente (404 anti-enum)", 404, inexist.status);
const famLista = await req(familia, "GET", "/medico/beneficiarios");
caso("família não lista beneficiários (RBAC)", 403, famLista.status);
const famAl = await req(familia, "POST", `/medico/beneficiarios/${fichaId}/alergias`, {
  descricao: "x",
});
caso("família não registra alergia (RBAC)", 403, famAl.status);

const total = resultados.length;
const ok = resultados.filter(Boolean).length;
console.log(`\n${ok}/${total}`);
if (ok !== total) process.exit(1);
console.log(">>> BENEFICIÁRIOS / FICHA CLÍNICA / PRONTUÁRIOS VALIDADOS <<<");
