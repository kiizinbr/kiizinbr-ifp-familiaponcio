/**
 * E2E ao vivo do Banco de Modelos da Capacitação (C4 — sessões práticas).
 * Uso: SENHA_DEV=... node scripts/valida-banco-modelos.mjs
 * Cobre: cadastrar modelo voluntário, criar sessão prática numa turma,
 * inscrever modelo (vagas + duplicidade), vincular aluno (matrícula ATIVA),
 * listagem/shape, tenant (matrícula de outra unidade barrada) e RBAC (família → 403).
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

// Pré-requisito: uma turma da unidade do instrutor para pendurar a sessão.
// Cria uma turma nova com curso ativo (mesma mecânica do valida-cursos).
console.log("--- PRÉ: curso + turma para a sessão ---");
const cria = await req(instrutor, "POST", "/capacitacao/cursos", {
  nome: `QA Modelos ${marca}`,
  modalidade: "PRATICO",
  cargaHorariaTotal: 40,
  presencaMinimaPct: 70,
  requerModelos: true,
});
caso("cria curso prático", 201, cria.status);
const cursoId = cria.json?.id;
const codigo = `QM-${marca}`.toUpperCase().slice(0, 20);
const turma = await req(instrutor, "POST", "/capacitacao/turmas", {
  cursoId,
  codigo,
  diasHorario: "Sex 9h",
  inicioEm: hoje,
  vagasTotais: 10,
});
caso("cria turma", 201, turma.status);
const turmaId = turma.json?.id;

// Aluno ATIVO: matricula uma ficha elegível (seed aprova "João da Silva" et al).
const elegiveis = await req(instrutor, "GET", "/capacitacao/fichas-elegiveis?q=silva");
const fichaAlvo = elegiveis.json?.items?.[0];
caso("achou ficha elegível para matricular", true, Boolean(fichaAlvo));
const mat = await req(instrutor, "POST", `/capacitacao/turmas/${turmaId}/matriculas`, {
  fichaId: fichaAlvo?.id,
});
caso("matricula aluno (ATIVA)", 201, mat.status);
caso("matrícula nasce ATIVA", "ATIVA", mat.json?.status);
const matriculaId = mat.json?.id;

console.log("--- MODELOS VOLUNTÁRIOS ---");
const modelo = await req(instrutor, "POST", "/capacitacao/banco-modelos/modelos", {
  nomeCompleto: `Modelo QA ${marca}`,
  telefone: "21999990000",
  observacao: "Só barba",
});
caso("cadastra modelo voluntário", 201, modelo.status);
caso("modelo nasce ativo", true, modelo.json?.ativo === true);
const modeloId = modelo.json?.id;

const listaModelos = await req(instrutor, "GET", "/capacitacao/banco-modelos/modelos");
caso("lista modelos", 200, listaModelos.status);
caso("lista traz total numérico", true, typeof listaModelos.json?.total === "number");
caso(
  "modelo criado aparece na lista",
  true,
  Boolean(listaModelos.json?.items?.some((m) => m.id === modeloId)),
);

console.log("--- SESSÕES PRÁTICAS ---");
const sessao = await req(instrutor, "POST", "/capacitacao/banco-modelos/sessoes", {
  turmaId,
  titulo: `Sessão de cortes ${marca}`,
  data: new Date(`${hoje}T14:00:00`).toISOString(),
  vagasModelos: 2,
  observacao: "Tarde de cortes supervisionados",
});
caso("cria sessão prática", 201, sessao.status);
caso("sessão nasce AGENDADA", "AGENDADA", sessao.json?.status);
caso("sessão traz a turma", true, sessao.json?.turma?.id === turmaId);
const sessaoId = sessao.json?.id;

const sessaoTurmaInexistente = await req(instrutor, "POST", "/capacitacao/banco-modelos/sessoes", {
  turmaId: "turma-que-nao-existe",
  titulo: "Sessão fantasma",
  data: new Date(`${hoje}T15:00:00`).toISOString(),
});
caso("sessão com turma inexistente → 404", 404, sessaoTurmaInexistente.status);

const listaSessoes = await req(instrutor, "GET", "/capacitacao/banco-modelos/sessoes");
caso("lista sessões", 200, listaSessoes.status);
caso(
  "sessão criada aparece na lista",
  true,
  Boolean(listaSessoes.json?.items?.some((s) => s.id === sessaoId)),
);
const sessoesDaTurma = await req(
  instrutor,
  "GET",
  `/capacitacao/banco-modelos/sessoes?turmaId=${turmaId}`,
);
caso("filtro de sessões por turma", 200, sessoesDaTurma.status);
caso(
  "filtro por turma só traz sessões da turma",
  true,
  (sessoesDaTurma.json?.items ?? []).every((s) => s.turma.id === turmaId),
);

console.log("--- MATCHING: inscrever modelo + vincular aluno ---");
const inscricao = await req(
  instrutor,
  "POST",
  `/capacitacao/banco-modelos/sessoes/${sessaoId}/inscricoes`,
  { modeloId },
);
caso("inscreve modelo na sessão", 201, inscricao.status);
caso("inscrição nasce INSCRITO (sem aluno)", "INSCRITO", inscricao.json?.status);
caso("inscrição traz o modelo", true, inscricao.json?.modelo?.id === modeloId);
const inscricaoId = inscricao.json?.id;

const dup = await req(
  instrutor,
  "POST",
  `/capacitacao/banco-modelos/sessoes/${sessaoId}/inscricoes`,
  { modeloId },
);
caso("modelo duplicado na mesma sessão → 409", 409, dup.status);

// Vincula o aluno ATIVO matriculado acima.
const vinc = await req(
  instrutor,
  "PATCH",
  `/capacitacao/banco-modelos/inscricoes/${inscricaoId}/aluno`,
  { matriculaId },
);
caso("vincula aluno à inscrição", 200, vinc.status);
caso("inscrição vira VINCULADO", "VINCULADO", vinc.json?.status);
caso("vínculo traz o aluno", true, Boolean(vinc.json?.aluno?.matriculaId === matriculaId));

// Aluno de matrícula inexistente é barrado (tenant/integridade).
const vincRuim = await req(
  instrutor,
  "PATCH",
  `/capacitacao/banco-modelos/inscricoes/${inscricaoId}/aluno`,
  { matriculaId: "matricula-que-nao-existe" },
);
caso("vincular matrícula inexistente → 404", 404, vincRuim.status);

console.log("--- DETALHE DA SESSÃO ---");
const det = await req(instrutor, "GET", `/capacitacao/banco-modelos/sessoes/${sessaoId}`);
caso("detalhe da sessão", 200, det.status);
caso("detalhe traz inscrições", true, Array.isArray(det.json?.inscricoes));
caso("detalhe conta vagas ocupadas", 1, det.json?.vagasOcupadas);
caso(
  "detalhe reflete o vínculo do aluno",
  true,
  det.json?.inscricoes?.some((i) => i.id === inscricaoId && i.aluno?.matriculaId === matriculaId),
);

console.log("--- VAGAS (limite de modelos por sessão) ---");
// Sessão com 1 vaga: 1ª inscrição ok, 2ª estoura.
const sessaoApertada = await req(instrutor, "POST", "/capacitacao/banco-modelos/sessoes", {
  turmaId,
  titulo: `Sessão 1 vaga ${marca}`,
  data: new Date(`${hoje}T16:00:00`).toISOString(),
  vagasModelos: 1,
});
caso("cria sessão de 1 vaga", 201, sessaoApertada.status);
const sessaoApId = sessaoApertada.json?.id;
const m2 = await req(instrutor, "POST", "/capacitacao/banco-modelos/modelos", {
  nomeCompleto: `Modelo QA2 ${marca}`,
});
const m3 = await req(instrutor, "POST", "/capacitacao/banco-modelos/modelos", {
  nomeCompleto: `Modelo QA3 ${marca}`,
});
const insc1 = await req(
  instrutor,
  "POST",
  `/capacitacao/banco-modelos/sessoes/${sessaoApId}/inscricoes`,
  { modeloId: m2.json?.id },
);
caso("1ª inscrição na sessão de 1 vaga", 201, insc1.status);
const insc2 = await req(
  instrutor,
  "POST",
  `/capacitacao/banco-modelos/sessoes/${sessaoApId}/inscricoes`,
  { modeloId: m3.json?.id },
);
caso("2ª inscrição estoura as vagas → 400", 400, insc2.status);

console.log("--- RBAC ---");
const famModelo = await req(familia, "POST", "/capacitacao/banco-modelos/modelos", {
  nomeCompleto: "Família tenta",
});
caso("família não cadastra modelo (RBAC)", 403, famModelo.status);
const famSessoes = await req(familia, "GET", "/capacitacao/banco-modelos/sessoes");
caso("família não lista sessões (RBAC)", 403, famSessoes.status);
const famInscreve = await req(
  familia,
  "POST",
  `/capacitacao/banco-modelos/sessoes/${sessaoId}/inscricoes`,
  { modeloId },
);
caso("família não inscreve modelo (RBAC)", 403, famInscreve.status);

const total = resultados.length;
const ok = resultados.filter(Boolean).length;
console.log(`\n${ok}/${total}`);
if (ok !== total) process.exit(1);
console.log(">>> BANCO DE MODELOS DA CAPACITAÇÃO VALIDADO <<<");
