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

console.log("--- TURMAS: OCUPAÇÃO + FILTROS (B2) ---");
const turmas = await req(instrutor, "GET", "/capacitacao/turmas");
caso("lista de turmas", 200, turmas.status);
caso("listagem traz total numérico", true, typeof turmas.json?.total === "number");
const turmaNova = (turmas.json?.items ?? []).find((t) => t.id === turma.json?.id);
caso("turma criada aparece na lista", true, Boolean(turmaNova));
caso("turma traz ocupacaoPct", true, turmaNova != null && "ocupacaoPct" in turmaNova);
caso("turma traz alunosAtivos", true, turmaNova != null && typeof turmaNova.alunosAtivos === "number");
// A turma nova foi criada com EM_ANDAMENTO (sem alunos) → ocupação 0%.
caso("turma nova com ocupação 0%", 0, turmaNova?.ocupacaoPct);

const turmasAndamento = await req(instrutor, "GET", "/capacitacao/turmas?status=EM_ANDAMENTO");
caso("filtro de turmas por status", 200, turmasAndamento.status);
caso(
  "filtro EM_ANDAMENTO só traz em andamento",
  true,
  (turmasAndamento.json?.items ?? []).every((t) => t.status === "EM_ANDAMENTO"),
);
const turmasDoCurso = await req(instrutor, "GET", `/capacitacao/turmas?cursoId=${cursoId}`);
caso("filtro de turmas por curso", 200, turmasDoCurso.status);
caso(
  "filtro por curso só traz turmas do curso",
  true,
  (turmasDoCurso.json?.items ?? []).every((t) => t.curso.id === cursoId),
);

console.log("--- CURSOS: OCUPAÇÃO + FILTROS (B2) ---");
const todosOcup = await req(instrutor, "GET", "/capacitacao/cursos/todos");
caso("gestão de cursos", 200, todosOcup.status);
const cursoNaGestao = (todosOcup.json?.items ?? []).find((c) => c.id === cursoId);
caso("curso traz ocupacaoPct", true, cursoNaGestao != null && "ocupacaoPct" in cursoNaGestao);
caso("curso traz vagasTotais somadas", true, cursoNaGestao != null && typeof cursoNaGestao.vagasTotais === "number");

const soAtivos = await req(instrutor, "GET", "/capacitacao/cursos/todos?filtro=ativos");
caso("filtro de cursos ativos", 200, soAtivos.status);
caso("filtro ativos só traz ativos", true, (soAtivos.json?.items ?? []).every((c) => c.ativo === true));
const soInativos = await req(instrutor, "GET", "/capacitacao/cursos/todos?filtro=inativos");
caso("filtro de cursos inativos", 200, soInativos.status);
caso("filtro inativos só traz inativos", true, (soInativos.json?.items ?? []).every((c) => c.ativo === false));

console.log("--- DETALHE DO CURSO (trilha: módulos + ementa) ---");
// O curso de seed "Barbearia Profissional" tem a trilha cadastrada (3 módulos).
const todosCursos = await req(instrutor, "GET", "/capacitacao/cursos/todos");
const cursoComTrilha = todosCursos.json?.items?.find((c) => c.nome === "Barbearia Profissional");
caso("curso de seed existe", true, Boolean(cursoComTrilha));
const det = await req(instrutor, "GET", `/capacitacao/cursos/${cursoComTrilha?.id}`);
caso("detalhe do curso", 200, det.status);
caso("detalhe traz módulos da trilha", true, Array.isArray(det.json?.modulos) && det.json.modulos.length >= 1);
caso("módulos vêm ordenados (ordem 1 primeiro)", 1, det.json?.modulos?.[0]?.ordem);
caso("módulo tem itens de ementa", true, Array.isArray(det.json?.modulos?.[0]?.itens) && det.json.modulos[0].itens.length >= 1);
caso("detalhe traz nº de turmas", true, typeof det.json?._count?.turmas === "number");
caso("detalhe soma carga dos módulos", true, typeof det.json?.cargaModulos === "number");

// Detalhe do curso recém-criado (sem trilha) deve vir com módulos vazios, não 404.
const detNovo = await req(instrutor, "GET", `/capacitacao/cursos/${cursoId}`);
caso("detalhe de curso sem trilha", 200, detNovo.status);
caso("curso sem trilha → módulos vazios", 0, detNovo.json?.modulos?.length);

const detInexistente = await req(instrutor, "GET", "/capacitacao/cursos/curso-que-nao-existe");
caso("curso inexistente → 404", 404, detInexistente.status);
const detRbac = await req(familia, "GET", `/capacitacao/cursos/${cursoComTrilha?.id}`);
caso("família não vê detalhe de curso (RBAC)", 403, detRbac.status);

console.log("--- MATRÍCULAS CONSOLIDADAS (semestre) ---");
const sem = await req(instrutor, "GET", "/capacitacao/matriculas/semestre");
caso("matrículas do semestre", 200, sem.status);
caso("consolidado agrupa por turma", true, Array.isArray(sem.json?.turmas));
caso("consolidado traz total numérico", true, typeof sem.json?.total === "number");
caso("consolidado traz totais por status", true, sem.json?.totaisPorStatus != null && typeof sem.json.totaisPorStatus === "object");
const semAtivas = await req(instrutor, "GET", "/capacitacao/matriculas/semestre?status=ATIVA");
caso("filtro por status (ATIVA)", 200, semAtivas.status);
const soAtivas = (semAtivas.json?.turmas ?? []).every((t) => t.alunos.every((a) => a.status === "ATIVA"));
caso("filtro ATIVA só devolve ativas", true, soAtivas);
const semInvalido = await req(instrutor, "GET", "/capacitacao/matriculas/semestre?status=BANANA");
caso("status inválido → 400", 400, semInvalido.status);
const semRbac = await req(familia, "GET", "/capacitacao/matriculas/semestre");
caso("família não vê matrículas consolidadas (RBAC)", 403, semRbac.status);

const total = resultados.length;
const ok = resultados.filter(Boolean).length;
console.log(`\n${ok}/${total}`);
if (ok !== total) process.exit(1);
console.log(">>> CURSOS DA CAPACITAÇÃO VALIDADOS <<<");
