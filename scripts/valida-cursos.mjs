/**
 * E2E ao vivo do CRUD de Cursos da Capacitação (Bloco A — pronto para uso).
 * Uso: SENHA_DEV=... node scripts/valida-cursos.mjs
 * Cobre: criar curso, nome duplicado, listagem (gestão + ativos), criar turma
 * com o curso novo, editar, desativar (some do select e barra nova turma) e RBAC.
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
  return j.accessToken;
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

console.log("--- CRIAÇÃO ---");
const nome = `QA Curso ${marca}`;
const cria = await req(instrutor, "POST", "/capacitacao/cursos", {
  nome,
  modalidade: "PRATICO",
  cargaHorariaTotal: 40,
  presencaMinimaPct: 70,
});
caso("instrutor cria curso", 201, cria.status);
const cursoId = cria.json?.id;
caso("curso nasce ativo", true, cria.json?.ativo === true);

const dup = await req(instrutor, "POST", "/capacitacao/cursos", {
  nome,
  modalidade: "TEORICO",
  cargaHorariaTotal: 20,
});
caso("nome de curso duplicado", 409, dup.status);

console.log("--- LISTAGEM ---");
const todos = await req(instrutor, "GET", "/capacitacao/cursos/todos");
caso("lista de gestão", 200, todos.status);
caso("gestão contém o curso", true, Boolean(todos.json?.items?.some((c) => c.id === cursoId)));
const ativos = await req(instrutor, "GET", "/capacitacao/cursos");
caso("curso aparece nos ativos (select de turma)", true, Boolean(ativos.json?.items?.some((c) => c.id === cursoId)));

console.log("--- USO (criar turma com o curso novo) ---");
const codigo = `QA-${marca}`.toUpperCase().slice(0, 20);
const turma = await req(instrutor, "POST", "/capacitacao/turmas", {
  cursoId,
  codigo,
  diasHorario: "Ter/Qui 9h",
  inicioEm: hoje,
  vagasTotais: 10,
});
caso("cria turma com o curso novo", 201, turma.status);

console.log("--- EDIÇÃO ---");
const edit = await req(instrutor, "PATCH", `/capacitacao/cursos/${cursoId}`, {
  presencaMinimaPct: 80,
});
caso("edita presença mínima", 200, edit.status);
caso("presença atualizada para 80", 80, edit.json?.presencaMinimaPct);

console.log("--- DESATIVAÇÃO ---");
const desat = await req(instrutor, "PATCH", `/capacitacao/cursos/${cursoId}`, { ativo: false });
caso("desativa curso", 200, desat.status);
const ativos2 = await req(instrutor, "GET", "/capacitacao/cursos");
caso("curso inativo some do select", false, Boolean(ativos2.json?.items?.some((c) => c.id === cursoId)));
const codigo2 = `QB-${marca}`.toUpperCase().slice(0, 20);
const turmaInativo = await req(instrutor, "POST", "/capacitacao/turmas", {
  cursoId,
  codigo: codigo2,
  diasHorario: "Seg 10h",
  inicioEm: hoje,
  vagasTotais: 5,
});
caso("turma com curso inativo é barrada (404)", 404, turmaInativo.status);

console.log("--- RBAC ---");
const fam = await req(familia, "POST", "/capacitacao/cursos", {
  nome: `QA Fam ${marca}`,
  modalidade: "PRATICO",
  cargaHorariaTotal: 10,
});
caso("família não cria curso (RBAC)", 403, fam.status);

console.log("--- INDICADORES ---");
const ind = await req(instrutor, "GET", "/capacitacao/indicadores");
caso("indicadores da capacitação", 200, ind.status);
caso("indicadores têm turmas por status", true, ind.json?.turmas != null && typeof ind.json.turmas === "object");

const total = resultados.length;
const ok = resultados.filter(Boolean).length;
console.log(`\n${ok}/${total}`);
if (ok !== total) process.exit(1);
console.log(">>> CURSOS DA CAPACITAÇÃO VALIDADOS <<<");
