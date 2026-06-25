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

console.log("--- MATRÍCULAS: BUSCA + FILTRO POR CURSO (A3) ---");
// Achata os alunos de todas as turmas do consolidado para checar os subconjuntos.
const alunosDoSemestre = (sem.json?.turmas ?? []).flatMap((t) =>
  t.alunos.map((a) => ({ ...a, cursoNome: t.curso })),
);
const alunoAlvo = alunosDoSemestre[0];
if (alunoAlvo) {
  // Busca pelo protocolo: o protocolo é um dos campos do OR e aparece em TODA
  // linha retornada, então o subconjunto é verificável sem ambiguidade (o nome
  // exibido pode ser de um dependente, mas o protocolo da ficha é estável).
  const termoProtocolo = alunoAlvo.protocolo;
  const buscaProto = await req(
    instrutor,
    "GET",
    `/capacitacao/matriculas/semestre?q=${encodeURIComponent(termoProtocolo)}`,
  );
  caso("busca por protocolo → 200", 200, buscaProto.status);
  caso(
    "busca por protocolo só traz quem casa o protocolo",
    true,
    (buscaProto.json?.turmas ?? [])
      .flatMap((t) => t.alunos)
      .every((a) => a.protocolo.toLowerCase().includes(termoProtocolo.toLowerCase())),
  );
  caso(
    "busca por protocolo acha o aluno alvo",
    true,
    (buscaProto.json?.turmas ?? []).some((t) => t.alunos.some((a) => a.id === alunoAlvo.id)),
  );
  caso(
    "busca por protocolo é subconjunto (total ≤ geral)",
    true,
    (buscaProto.json?.total ?? 0) <= (sem.json?.total ?? 0),
  );

  // Busca por nome: confirma que o filtro acha o alvo e estreita o conjunto.
  const termoNome = alunoAlvo.aluno.split(" ")[0];
  const buscaNome = await req(
    instrutor,
    "GET",
    `/capacitacao/matriculas/semestre?q=${encodeURIComponent(termoNome)}`,
  );
  caso("busca por nome → 200", 200, buscaNome.status);
  caso(
    "busca por nome acha o aluno alvo",
    true,
    (buscaNome.json?.turmas ?? []).some((t) => t.alunos.some((a) => a.id === alunoAlvo.id)),
  );
  caso(
    "busca por nome é subconjunto (total ≤ geral)",
    true,
    (buscaNome.json?.total ?? 0) <= (sem.json?.total ?? 0),
  );
}

// Busca improvável → consolidado vazio (filtro realmente estreita).
const buscaVazia = await req(
  instrutor,
  "GET",
  "/capacitacao/matriculas/semestre?q=zzz-aluno-inexistente-321",
);
caso("busca improvável → 200", 200, buscaVazia.status);
caso("busca improvável → 0 matrículas", 0, buscaVazia.json?.total);
caso("busca improvável → 0 turmas", 0, buscaVazia.json?.turmas?.length);

// Filtro por curso: toda turma retornada tem de ser do curso pedido. Usa o curso
// recém-criado (cursoId), que tem turma mas nenhuma matrícula → consolidado vazio.
const porCursoNovo = await req(
  instrutor,
  "GET",
  `/capacitacao/matriculas/semestre?cursoId=${cursoId}`,
);
caso("filtro por curso → 200", 200, porCursoNovo.status);
caso("curso sem matrícula → consolidado vazio", 0, porCursoNovo.json?.total);

// Filtro por curso do seed (Barbearia) — todas as turmas têm de ser desse curso.
if (cursoComTrilha?.id) {
  const porCursoSeed = await req(
    instrutor,
    "GET",
    `/capacitacao/matriculas/semestre?cursoId=${cursoComTrilha.id}`,
  );
  caso("filtro por curso do seed → 200", 200, porCursoSeed.status);
  caso(
    "filtro por curso só traz turmas daquele curso",
    true,
    (porCursoSeed.json?.turmas ?? []).every((t) => t.curso === cursoComTrilha.nome),
  );
  caso(
    "filtro por curso é subconjunto (total ≤ geral)",
    true,
    (porCursoSeed.json?.total ?? 0) <= (sem.json?.total ?? 0),
  );
}

console.log("--- INDICADORES LONGITUDINAIS (A2: séries temporais) ---");
const CHAVES_SERIE = ["matriculas", "conclusoes", "certificados", "evasoes"];

const serieDefault = await req(instrutor, "GET", "/capacitacao/indicadores/series");
caso("séries (default 12m)", 200, serieDefault.status);
caso("default devolve 12 meses", 12, serieDefault.json?.meses);
caso(
  "12 meses → 12 pontos por série",
  true,
  Array.isArray(serieDefault.json?.series) &&
    serieDefault.json.series.length === CHAVES_SERIE.length &&
    serieDefault.json.series.every((s) => Array.isArray(s.pontos) && s.pontos.length === 12),
);
caso(
  "todas as chaves de série presentes",
  true,
  CHAVES_SERIE.every((c) => serieDefault.json?.series?.some((s) => s.chave === c)),
);
caso(
  "pontos têm mes (YYYY-MM) e total inteiro",
  true,
  (serieDefault.json?.series ?? []).every((s) =>
    s.pontos.every((p) => /^\d{4}-\d{2}$/.test(p.mes) && Number.isInteger(p.total) && p.total >= 0),
  ),
);
caso(
  "meses em ordem crescente",
  true,
  (serieDefault.json?.series ?? []).every((s) => {
    const ms = s.pontos.map((p) => p.mes);
    return ms.every((m, i) => i === 0 || m > ms[i - 1]);
  }),
);
// KPI = soma da própria série (coerência número grande × gráfico).
caso(
  "KPI matrículas == soma da série",
  true,
  (() => {
    const serie = serieDefault.json?.series?.find((s) => s.chave === "matriculas");
    const soma = (serie?.pontos ?? []).reduce((a, p) => a + p.total, 0);
    return soma === serieDefault.json?.kpis?.matriculas;
  })(),
);
caso(
  "taxaConclusao é número (0-100) ou null",
  true,
  serieDefault.json?.kpis?.taxaConclusao === null ||
    (Number.isInteger(serieDefault.json?.kpis?.taxaConclusao) &&
      serieDefault.json.kpis.taxaConclusao >= 0 &&
      serieDefault.json.kpis.taxaConclusao <= 100),
);

// Janela explícita e saneamento (min 3, max 24).
const serie6 = await req(instrutor, "GET", "/capacitacao/indicadores/series?meses=6");
caso("janela de 6 meses", 6, serie6.json?.meses);
caso("6 meses → 6 pontos", true, (serie6.json?.series ?? []).every((s) => s.pontos.length === 6));
const serieAlta = await req(instrutor, "GET", "/capacitacao/indicadores/series?meses=999");
caso("meses acima do teto satura em 24", 24, serieAlta.json?.meses);
const serieBaixa = await req(instrutor, "GET", "/capacitacao/indicadores/series?meses=1");
caso("meses abaixo do piso satura em 3", 3, serieBaixa.json?.meses);
const serieLixo = await req(instrutor, "GET", "/capacitacao/indicadores/series?meses=abc");
caso("meses não-numérico cai no default 12", 12, serieLixo.json?.meses);

// SQLi: payload malicioso no parâmetro NÃO deve derrubar nem vazar — vira default.
const sqli = await req(
  instrutor,
  "GET",
  `/capacitacao/indicadores/series?meses=${encodeURIComponent("12; DROP TABLE matriculas;--")}`,
);
caso("payload SQLi no meses → 200 sem quebrar", 200, sqli.status);
caso("payload SQLi vira número saneado", true, Number.isInteger(sqli.json?.meses));
// Prova viva de que matriculas continua de pé após a tentativa de DROP.
const aindaVivo = await req(instrutor, "GET", "/capacitacao/matriculas/semestre");
caso("tabela matriculas intacta após SQLi", 200, aindaVivo.status);

// RBAC: família não enxerga indicadores da unidade.
const serieRbac = await req(familia, "GET", "/capacitacao/indicadores/series");
caso("família não vê séries (RBAC)", 403, serieRbac.status);

const total = resultados.length;
const ok = resultados.filter(Boolean).length;
console.log(`\n${ok}/${total}`);
if (ok !== total) process.exit(1);
console.log(">>> CURSOS DA CAPACITAÇÃO VALIDADOS <<<");
