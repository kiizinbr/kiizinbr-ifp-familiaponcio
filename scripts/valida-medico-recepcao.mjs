/**
 * E2E do acesso da RECEPCAO ao balcão do Centro Médico (Bloco H): fila da
 * unidade (todos os profissionais) e gestão de agendamento de qualquer médico.
 * Uso: SENHA_DEV=... node scripts/valida-medico-recepcao.mjs
 */
const API = process.env.API_URL_TESTE ?? "http://127.0.0.1:3333/api/v1";
const SENHA = process.env.SENHA_DEV;
if (!SENHA) {
  console.error("Defina SENHA_DEV");
  process.exit(2);
}

async function loginFull(email, senha) {
  const r = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, senha }),
  });
  let j = null;
  try {
    j = await r.json();
  } catch {
    /* sem corpo */
  }
  return { status: r.status, token: j?.accessToken };
}
async function login(email) {
  const r = await loginFull(email, SENHA);
  if (r.status !== 200) throw new Error(`login ${email}: ${r.status}`);
  return r.token;
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

const admin = await login("admin@ifp.local");
const medico = await login("medico@ifp.local");
const familia = await login("familia@ifp.local");
const marca = Date.now().toString(36);

console.log("--- SETUP (recepção na unidade médica) ---");
const recEmail = `qa.rec.${marca}@ifp.local`;
const recUser = await req(admin, "POST", "/users", {
  nome: "QA Recepção",
  email: recEmail,
  perfis: ["RECEPCAO"],
  unidades: ["medico"],
});
caso("admin cria recepção", 201, recUser.status);
const recUserId = recUser.json?.user?.id;
const recProv = recUser.json?.senhaProvisoria;

// a recepção nasce com senha provisória → precisa trocar antes de operar
const primeiro = await loginFull(recEmail, recProv);
await req(primeiro.token, "POST", "/auth/trocar-senha", {
  senhaAtual: recProv,
  novaSenha: "RecNova#1",
});
const rec = (await loginFull(recEmail, "RecNova#1")).token;

console.log("--- FILA DA UNIDADE ---");
const fila = await req(rec, "GET", "/medico/fila");
caso("recepção vê a fila da unidade", 200, fila.status);
caso("fila traz items[]", true, Array.isArray(fila.json?.items));
const medFila = await req(medico, "GET", "/medico/fila");
caso("médico também vê a fila da unidade", 200, medFila.status);

console.log("--- GESTÃO PELO BALCÃO ---");
// o médico cria um agendamento; a recepção (que não é a dona) deve conseguir geri-lo
let fichaId = null;
for (const t of ["silva", "oliveira", "santos"]) {
  const r = await req(medico, "GET", `/medico/fichas?q=${t}`);
  if (r.json?.items?.length) {
    fichaId = r.json.items[0].id;
    break;
  }
}
const novoAg = await req(medico, "POST", "/medico/agendamentos", {
  fichaId,
  inicioEm: new Date(Date.now() + 3600_000).toISOString(),
  motivo: "QA recepção",
});
caso("médico cria agendamento", 201, novoAg.status);
const agId = novoAg.json?.id;

const gestao = await req(rec, "PATCH", `/medico/agendamentos/${agId}`, { status: "FALTOU" });
caso("recepção gere agendamento de outro profissional (balcão)", 200, gestao.status);
caso("status aplicado", "FALTOU", gestao.json?.status);

console.log("--- RBAC ---");
const famFila = await req(familia, "GET", "/medico/fila");
caso("família não vê a fila (RBAC)", 403, famFila.status);
const famGestao = await req(familia, "PATCH", `/medico/agendamentos/${agId}`, { status: "CONFIRMADO" });
caso("família não gere agendamento (RBAC)", 403, famGestao.status);

// limpeza
await req(admin, "PATCH", `/users/${recUserId}/ativo`, { ativo: false });

const total = resultados.length;
const ok = resultados.filter(Boolean).length;
console.log(`\n${ok}/${total}`);
if (ok !== total) process.exit(1);
console.log(">>> ACESSO DA RECEPÇÃO VALIDADO <<<");
