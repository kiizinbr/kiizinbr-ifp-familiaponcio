/**
 * E2E ao vivo da vertical Esportivo (trio Modalidade/TurmaEsportiva/Graduação).
 * Uso: SENHA_DEV=... node scripts/valida-esportivo.mjs
 * Cobre: KPIs, modalidades, criação de turma, matrícula com lock de vagas e
 * lista de espera, graduação na trilha (com verificação pública) e RBAC cruzado.
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
  return j.accessToken ?? j.access_token ?? j.token;
}

async function req(token, method, path, body) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

const sensei = await login("esporte@ifp.local");
const medico = await login("medico@ifp.local");
const familia = await login("familia@ifp.local");

console.log("--- PAINEL E MODALIDADES ---");
const resumo = await req(sensei, "GET", "/esportivo/resumo");
caso("sensei -> resumo", 200, resumo.status);
console.log(`    KPIs: ${JSON.stringify(resumo.json)}`);

const modalidades = await req(sensei, "GET", "/esportivo/modalidades");
caso("sensei -> modalidades", 200, modalidades.status);
const judo = modalidades.json?.items?.find((m) => m.nome === "Judô");
if (!judo) throw new Error("Modalidade Judô não encontrada — rode o seed");

console.log("--- TURMA + MATRÍCULAS (lock de vagas) ---");
const marca = Date.now().toString(36).toUpperCase();
const turma = await req(sensei, "POST", "/esportivo/turmas", {
  modalidadeId: judo.id,
  codigo: `JUDO-REG-${marca}`,
  diasHorario: "Ter/Qui 9h-10h30",
  local: "Tatame 1",
  faixaEtariaMin: 6,
  faixaEtariaMax: 12,
  inicioEm: "2026-06-01",
  vagasTotais: 1, // 1 vaga de propósito: a 2ª matrícula tem de cair na espera
});
caso("sensei -> cria turma", 201, turma.status);

const fichas = await req(sensei, "GET", "/esportivo/fichas-elegiveis?q=ana");
caso("sensei -> fichas elegíveis (busca)", 200, fichas.status);

// As duas fichas aprovadas no seed (111/222) — matrícula direta por id
const elegiveis = [];
for (const q of ["jo", "ma"]) {
  const r = await req(sensei, "GET", `/esportivo/fichas-elegiveis?q=${q}`);
  for (const f of r.json?.items ?? []) {
    if (!elegiveis.some((e) => e.id === f.id)) elegiveis.push(f);
  }
}
if (elegiveis.length < 2) throw new Error("Esperava 2 fichas elegíveis no Esportivo");

const m1 = await req(sensei, "POST", `/esportivo/turmas/${turma.json.id}/matriculas`, {
  fichaId: elegiveis[0].id,
});
caso("matrícula 1 (única vaga)", 201, m1.status);
caso("matrícula 1 ATIVA", "ATIVA", m1.json?.status);

const m1dup = await req(sensei, "POST", `/esportivo/turmas/${turma.json.id}/matriculas`, {
  fichaId: elegiveis[0].id,
});
caso("matrícula duplicada", 409, m1dup.status);

const m2 = await req(sensei, "POST", `/esportivo/turmas/${turma.json.id}/matriculas`, {
  fichaId: elegiveis[1].id,
});
caso("matrícula 2 (lotada)", 201, m2.status);
caso("matrícula 2 LISTA_ESPERA", "LISTA_ESPERA", m2.json?.status);
caso("posição de espera = 1", 1, m2.json?.posicaoEspera);

const semElegibilidade = await req(
  sensei,
  "POST",
  `/esportivo/turmas/${turma.json.id}/matriculas`,
  { fichaId: "ficha-inexistente" },
);
caso("ficha sem elegibilidade (regra de ouro)", 400, semElegibilidade.status);

console.log("--- GRADUAÇÃO (trilha + verificação pública) ---");
const grad = await req(sensei, "POST", `/esportivo/matriculas/${m1.json.id}/graduacoes`, {
  nivel: "Faixa Cinza",
  observacao: "Exame de 2026-06",
});
caso("concede Faixa Cinza", 201, grad.status);

const gradDup = await req(sensei, "POST", `/esportivo/matriculas/${m1.json.id}/graduacoes`, {
  nivel: "Faixa Cinza",
});
caso("mesmo nível 2x", 409, gradDup.status);

const foraDaTrilha = await req(
  sensei,
  "POST",
  `/esportivo/matriculas/${m1.json.id}/graduacoes`,
  { nivel: "Faixa Preta" },
);
caso("nível fora da trilha", 400, foraDaTrilha.status);

const verifica = await req(
  null,
  "GET",
  `/esportivo/graduacoes/verificar/${grad.json?.codigoVerificacao}`,
);
caso("verificação pública (sem token)", 200, verifica.status);
caso("verificação valida=true", true, Boolean(verifica.json?.valido));
console.log(
  `    ${verifica.json?.atleta} — ${verifica.json?.nivel} (${verifica.json?.modalidade})`,
);

const verificaFake = await req(null, "GET", "/esportivo/graduacoes/verificar/codigo-falso");
caso("código falso", 404, verificaFake.status);

console.log("--- TREINO + CHAMADA SELADA ---");
const treino = await req(sensei, "POST", `/esportivo/turmas/${turma.json.id}/treinos`, {
  data: new Date().toISOString(),
  conteudo: "Ukemi e randori leve",
});
caso("sensei -> registra treino", 201, treino.status);

const chamada = await req(sensei, "PUT", `/esportivo/treinos/${treino.json?.id}/chamada`, {
  itens: [{ matriculaId: m1.json.id, status: "PRESENTE" }],
});
caso("lança chamada", 200, chamada.status);

const chamadaInvalida = await req(
  sensei,
  "PUT",
  `/esportivo/treinos/${treino.json?.id}/chamada`,
  { itens: [{ matriculaId: "matricula-de-outra-turma", status: "FALTA" }] },
);
caso("chamada com matrícula alheia", 400, chamadaInvalida.status);

const selo = await req(sensei, "POST", `/esportivo/treinos/${treino.json?.id}/encerrar`);
caso("sela o treino", 200, selo.status);

const chamadaPosSelo = await req(
  sensei,
  "PUT",
  `/esportivo/treinos/${treino.json?.id}/chamada`,
  { itens: [{ matriculaId: m1.json.id, status: "FALTA" }] },
);
caso("chamada após o selo (imutável)", 409, chamadaPosSelo.status);

const selo2 = await req(sensei, "POST", `/esportivo/treinos/${treino.json?.id}/encerrar`);
caso("selar 2x", 409, selo2.status);

console.log("--- RBAC CRUZADO ---");
const medicoNega = await req(medico, "GET", "/esportivo/turmas");
caso("médico -> esportivo (parede de tenant)", 403, medicoNega.status);
const familiaNega = await req(familia, "POST", `/esportivo/matriculas/${m1.json.id}/graduacoes`, {
  nivel: "Faixa Azul",
});
caso("família -> graduar (RBAC)", 403, familiaNega.status);

console.log("--- ENCERRAMENTO ---");
const encerra = await req(sensei, "POST", `/esportivo/turmas/${turma.json.id}/encerrar`);
caso("sensei -> encerra turma", 200, encerra.status);
caso("ativas concluídas", 1, encerra.json?.concluidas);
caso("espera cancelada", 1, encerra.json?.esperaCanceladas);

const encerra2 = await req(sensei, "POST", `/esportivo/turmas/${turma.json.id}/encerrar`);
caso("encerrar 2x", 409, encerra2.status);

const total = resultados.length;
const ok = resultados.filter(Boolean).length;
console.log(`\n${ok}/${total}`);
if (ok !== total) process.exit(1);
console.log(">>> VERTICAL ESPORTIVO VALIDADA <<<");
