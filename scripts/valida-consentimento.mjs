/**
 * E2E do CONSENTIMENTO de menor na matrícula da Capacitação (LGPD).
 * Uso: SENHA_DEV=... node scripts/valida-consentimento.mjs
 * Pré: seed rodado — a ficha cpf 11111111111 (João) tem o dependente menor
 *      "Lucas da Silva (menor)" (15 anos) e está APROVADA na Capacitação.
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
  console.log(`${ok ? "✓" : "✗ FALHOU"} ${nome}: ${JSON.stringify(obtido)} (espera ${JSON.stringify(esperado)})`);
}

const instrutor = await login("instrutor@ifp.local");

// Curso existente → turma FRESCA (slate limpo, sem matrículas pré-existentes do seed).
const cursosR = await req(instrutor, "GET", "/capacitacao/cursos/todos");
const cursos = cursosR.json?.items ?? cursosR.json ?? [];
const cursoId = cursos[0]?.id;
if (!cursoId) {
  console.error("Nenhum curso encontrado — rode o seed.");
  process.exit(2);
}

const marca = Date.now().toString().slice(-6);
const turmaR = await req(instrutor, "POST", "/capacitacao/turmas", {
  cursoId,
  codigo: `CONS-${marca}`,
  diasHorario: "Qua 10h",
  inicioEm: new Date().toISOString(),
  vagasTotais: 10,
});
if (turmaR.status !== 201) {
  console.error("Falha ao criar turma", turmaR.status, turmaR.json);
  process.exit(2);
}
const turmaId = turmaR.json.id;

// Acha João (titular adulto) + Lucas (dependente menor) nas fichas elegíveis.
const elR = await req(instrutor, "GET", `/capacitacao/fichas-elegiveis?q=joao`);
const fichaJoao = (elR.json?.items ?? []).find((f) => /jo[aã]o/i.test(f.nomeCompleto));
if (!fichaJoao) {
  console.error("João elegível não encontrado — rode o seed.");
  process.exit(2);
}
const fichaId = fichaJoao.id;
const lucas = (fichaJoao.membros ?? []).find((m) => /lucas/i.test(m.nomeCompleto));
if (!lucas) {
  console.error("Dependente menor Lucas não encontrado — rode o seed atualizado.");
  process.exit(2);
}
const menorId = lucas.id;

console.log("--- ADULTO (titular) não precisa de consentimento ---");
const adulto = await req(instrutor, "POST", `/capacitacao/turmas/${turmaId}/matriculas`, { fichaId });
caso("matricula titular adulto (sem consentimento) → 201", 201, adulto.status);
caso("adulto NÃO marca consentidoPorTitularEm", true, adulto.json?.consentidoPorTitularEm == null);

console.log("--- MENOR sem consentimento é BARRADO ---");
const semCons = await req(instrutor, "POST", `/capacitacao/turmas/${turmaId}/matriculas`, {
  fichaId,
  membroId: menorId,
});
caso("matricula menor SEM consentimento → 400", 400, semCons.status);
caso("código CONSENTIMENTO_NECESSARIO", "CONSENTIMENTO_NECESSARIO", semCons.json?.code);

console.log("--- MENOR com consentimento do titular ---");
const comCons = await req(instrutor, "POST", `/capacitacao/turmas/${turmaId}/matriculas`, {
  fichaId,
  membroId: menorId,
  consentimentoTitular: true,
});
caso("matricula menor COM consentimento → 201", 201, comCons.status);
caso("registra consentidoPorTitularEm", true, comCons.json?.consentidoPorTitularEm != null);

console.log("--- DUPLICADA ---");
const dup = await req(instrutor, "POST", `/capacitacao/turmas/${turmaId}/matriculas`, {
  fichaId,
  membroId: menorId,
  consentimentoTitular: true,
});
caso("menor já matriculado → 409", 409, dup.status);

const total = resultados.length;
const ok = resultados.filter(Boolean).length;
console.log(`\n${ok}/${total}`);
if (ok !== total) process.exit(1);
console.log(">>> CONSENTIMENTO DE MENOR (LGPD) VALIDADO <<<");
