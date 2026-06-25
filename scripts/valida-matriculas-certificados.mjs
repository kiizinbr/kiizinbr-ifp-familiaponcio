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

const edicao = await req(instrutor, "PATCH", `/capacitacao/turmas/${turmaId}`, {
  diasHorario: "Sex 16h",
  vagasTotais: 8,
});
caso("edita turma (horário/vagas)", 200, edicao.status);
caso("vagas atualizadas para 8", 8, edicao.json?.vagasTotais);

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

console.log("--- CERTIFICADOS: FILTROS/BUSCA (A3) ---");
const todosCerts = certs.json?.items ?? [];

const alvo = todosCerts[0];
if (alvo) {
  // Busca por nome: confirma que o filtro acha o alvo e estreita o conjunto.
  // (O subconjunto estrito é checado pelo código abaixo — campo único e exibido.)
  const termoAluno = alvo.aluno.split(" ")[0];
  const buscaAluno = await req(
    instrutor,
    "GET",
    `/capacitacao/certificados?q=${encodeURIComponent(termoAluno)}`,
  );
  caso("busca por aluno responde 200", 200, buscaAluno.status);
  caso(
    "busca por aluno acha o certificado alvo",
    true,
    (buscaAluno.json?.items ?? []).some((c) => c.id === alvo.id),
  );
  caso(
    "busca por aluno é subconjunto (≤ total)",
    true,
    (buscaAluno.json?.items?.length ?? 0) <= todosCerts.length,
  );

  // Busca pelo código de verificação (2ª via): o código é único e aparece em
  // toda linha, então o subconjunto é verificável sem ambiguidade.
  const buscaCodigo = await req(
    instrutor,
    "GET",
    `/capacitacao/certificados?q=${encodeURIComponent(alvo.codigoVerificacao)}`,
  );
  caso("busca pelo código acha o certificado", true, (buscaCodigo.json?.items ?? []).some((c) => c.id === alvo.id));
  caso(
    "busca pelo código só traz quem casa o código",
    true,
    (buscaCodigo.json?.items ?? []).every((c) =>
      c.codigoVerificacao.toLowerCase().includes(alvo.codigoVerificacao.toLowerCase()),
    ),
  );
} else {
  // Sem certificados no seed: a busca ainda precisa responder 200 com items vazio.
  const buscaVazia = await req(instrutor, "GET", "/capacitacao/certificados?q=zzznaoexiste");
  caso("busca sem dados responde 200", 200, buscaVazia.status);
  caso("busca sem dados traz items[]", true, Array.isArray(buscaVazia.json?.items));
}

// Termo improvável → subconjunto vazio (filtro realmente estreita).
const buscaInexistente = await req(
  instrutor,
  "GET",
  "/capacitacao/certificados?q=zzz-termo-improvavel-9876",
);
caso("busca improvável → 200", 200, buscaInexistente.status);
caso("busca improvável → vazio", 0, buscaInexistente.json?.items?.length);

// Filtro por curso: todo item retornado tem de ser do curso pedido. Usa o curso
// de algum certificado existente (se houver) cruzando com a gestão de cursos.
const cursosGestao = (await req(instrutor, "GET", "/capacitacao/cursos/todos")).json?.items ?? [];
if (alvo) {
  const cursoDoAlvo = cursosGestao.find((c) => c.nome === alvo.curso);
  if (cursoDoAlvo) {
    const porCurso = await req(
      instrutor,
      "GET",
      `/capacitacao/certificados?cursoId=${cursoDoAlvo.id}`,
    );
    caso("filtro por curso → 200", 200, porCurso.status);
    caso(
      "filtro por curso só traz daquele curso",
      true,
      (porCurso.json?.items ?? []).every((c) => c.curso === alvo.curso),
    );
    caso(
      "filtro por curso é subconjunto (≤ total)",
      true,
      (porCurso.json?.items?.length ?? 0) <= todosCerts.length,
    );
  }
}

// Filtro por período: janela futura não pode conter nada (todos emitidos no passado).
const futuro = await req(
  instrutor,
  "GET",
  "/capacitacao/certificados?de=2999-01-01&ate=2999-12-31",
);
caso("período futuro → 200", 200, futuro.status);
caso("período futuro → vazio", 0, futuro.json?.items?.length);

// Janela ampla (passado→hoje) tem de devolver o total (nenhum certificado fora dela).
const hojeIso = new Date().toISOString().slice(0, 10);
const janelaAmpla = await req(
  instrutor,
  "GET",
  `/capacitacao/certificados?de=2000-01-01&ate=${hojeIso}`,
);
caso("período amplo → 200", 200, janelaAmpla.status);
caso("período amplo cobre todos", todosCerts.length, janelaAmpla.json?.items?.length);

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
