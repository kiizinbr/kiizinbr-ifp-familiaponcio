/**
 * E2E ao vivo da gestão de matrícula (trancar/cancelar/reativar) e da listagem
 * de certificados da Capacitação (Bloco B).
 * Uso: SENHA_DEV=... node scripts/valida-matriculas-certificados.mjs
 * Pré: seed rodado (usa uma ficha já elegível de uma turma existente).
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

const instrutor = await login("instrutor@ifp.local");
const familia = await login("familia@ifp.local");
const marca = Date.now().toString(36);
const hoje = new Date().toISOString().slice(0, 10);

// Acha uma ficha já elegível (matriculada em alguma turma do seed).
const turmas = (await req(instrutor, "GET", "/capacitacao/turmas")).json?.items ?? [];
let fichaId = null;
for (const t of turmas) {
  const det = await req(instrutor, "GET", `/capacitacao/turmas/${t.id}`);
  const m = det.json?.matriculas?.find((x) => x.ficha?.id);
  if (m) {
    fichaId = m.ficha.id;
    break;
  }
}
if (!fichaId) {
  console.error("Nenhuma ficha elegível encontrada — rode o seed.");
  process.exit(2);
}

console.log("--- SETUP (curso + turma) ---");
const curso = await req(instrutor, "POST", "/capacitacao/cursos", {
  nome: `QA Mat ${marca}`,
  modalidade: "PRATICO",
  cargaHorariaTotal: 10,
  presencaMinimaPct: 50,
});
caso("cria curso", 201, curso.status);
const turma = await req(instrutor, "POST", "/capacitacao/turmas", {
  cursoId: curso.json?.id,
  codigo: `MAT-${marca}`.toUpperCase().slice(0, 20),
  diasHorario: "Qua 14h",
  inicioEm: hoje,
  vagasTotais: 5,
});
caso("cria turma", 201, turma.status);
const turmaId = turma.json?.id;

const mat = await req(instrutor, "POST", `/capacitacao/turmas/${turmaId}/matriculas`, { fichaId });
caso("matricula aluno", 201, mat.status);
const matriculaId = mat.json?.id;
caso("matrícula nasce ATIVA", "ATIVA", mat.json?.status);

console.log("--- TRANCAR / REATIVAR / CANCELAR ---");
const trancar = await req(instrutor, "PATCH", `/capacitacao/matriculas/${matriculaId}`, { status: "TRANCADA" });
caso("tranca matrícula", 200, trancar.status);
caso("status vira TRANCADA", "TRANCADA", trancar.json?.status);

const reativar = await req(instrutor, "PATCH", `/capacitacao/matriculas/${matriculaId}`, { status: "ATIVA" });
caso("reativa matrícula", 200, reativar.status);
caso("status volta ATIVA", "ATIVA", reativar.json?.status);

const invalido = await req(instrutor, "PATCH", `/capacitacao/matriculas/${matriculaId}`, { status: "CONCLUIDA" });
caso("status não permitido (CONCLUIDA) barrado", 400, invalido.status);

const cancelar = await req(instrutor, "PATCH", `/capacitacao/matriculas/${matriculaId}`, { status: "CANCELADA" });
caso("cancela matrícula", 200, cancelar.status);
caso("status vira CANCELADA", "CANCELADA", cancelar.json?.status);

console.log("--- CERTIFICADOS (listagem) ---");
const certs = await req(instrutor, "GET", "/capacitacao/certificados");
caso("lista certificados", 200, certs.status);
caso("retorno tem items[]", true, Array.isArray(certs.json?.items));

console.log("--- RBAC ---");
const famAltera = await req(familia, "PATCH", `/capacitacao/matriculas/${matriculaId}`, { status: "ATIVA" });
caso("família não altera matrícula (RBAC)", 403, famAltera.status);
const famCerts = await req(familia, "GET", "/capacitacao/certificados");
caso("família não lista certificados (RBAC)", 403, famCerts.status);

const total = resultados.length;
const ok = resultados.filter(Boolean).length;
console.log(`\n${ok}/${total}`);
if (ok !== total) process.exit(1);
console.log(">>> MATRÍCULA / CERTIFICADOS VALIDADOS <<<");
