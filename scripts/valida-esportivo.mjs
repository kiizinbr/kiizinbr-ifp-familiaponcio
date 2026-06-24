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

console.log("--- DIPLOMA DE GRADUAÇÃO EM PDF (download público) ---");
const pdfRes = await fetch(
  `${API}/esportivo/graduacoes/verificar/${grad.json?.codigoVerificacao}/pdf`,
);
caso("baixa diploma PDF (sem token)", 200, pdfRes.status);
caso(
  "content-type é application/pdf",
  true,
  (pdfRes.headers.get("content-type") ?? "").includes("application/pdf"),
);
const pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
caso("corpo começa com a assinatura %PDF", "%PDF", pdfBuf.subarray(0, 4).toString("latin1"));
caso("PDF tem tamanho razoável (>1KB)", true, pdfBuf.length > 1024);
const pdfFake = await fetch(`${API}/esportivo/graduacoes/verificar/codigo-falso/pdf`);
caso("PDF de código inexistente", 404, pdfFake.status);

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
// Sumário da chamada vem junto (KPIs de frequência da tela do instrutor).
caso("chamada traz resumoPresenca", true, chamada.json?.resumoPresenca != null);
caso("resumo: 1 presente", 1, chamada.json?.resumoPresenca?.presentes);
caso("resumo: 0 atrasos (ainda)", 0, chamada.json?.resumoPresenca?.atrasos);
caso("resumo: % presença 100", 100, chamada.json?.resumoPresenca?.pctPresenca);

// 4º estado da chamada: ATRASADO (chegou tarde, mas treinou → conta como compareceu).
const chamadaAtraso = await req(sensei, "PUT", `/esportivo/treinos/${treino.json?.id}/chamada`, {
  itens: [{ matriculaId: m1.json.id, status: "ATRASADO" }],
});
caso("lança chamada com ATRASADO (4º estado)", 200, chamadaAtraso.status);
caso("resumo: 1 atraso", 1, chamadaAtraso.json?.resumoPresenca?.atrasos);
caso("resumo: 0 presentes (virou atraso)", 0, chamadaAtraso.json?.resumoPresenca?.presentes);
caso("resumo: compareceu = 1 (atraso conta)", 1, chamadaAtraso.json?.resumoPresenca?.compareceu);
caso("resumo: % presença 100 (atraso compareceu)", 100, chamadaAtraso.json?.resumoPresenca?.pctPresenca);

const chamadaInvalida = await req(
  sensei,
  "PUT",
  `/esportivo/treinos/${treino.json?.id}/chamada`,
  { itens: [{ matriculaId: "matricula-de-outra-turma", status: "FALTA" }] },
);
caso("chamada com matrícula alheia", 400, chamadaInvalida.status);

// Volta para PRESENTE antes de selar (deixa um treino selado com presença “limpa”).
await req(sensei, "PUT", `/esportivo/treinos/${treino.json?.id}/chamada`, {
  itens: [{ matriculaId: m1.json.id, status: "PRESENTE" }],
});

const selo = await req(sensei, "POST", `/esportivo/treinos/${treino.json?.id}/encerrar`);
caso("sela o treino", 200, selo.status);
caso("selo devolve resumoPresenca", true, selo.json?.resumoPresenca != null);
caso("selo: % presença 100 (1 presente)", 100, selo.json?.resumoPresenca?.pctPresenca);

const chamadaPosSelo = await req(
  sensei,
  "PUT",
  `/esportivo/treinos/${treino.json?.id}/chamada`,
  { itens: [{ matriculaId: m1.json.id, status: "FALTA" }] },
);
caso("chamada após o selo (imutável)", 409, chamadaPosSelo.status);

const selo2 = await req(sensei, "POST", `/esportivo/treinos/${treino.json?.id}/encerrar`);
caso("selar 2x", 409, selo2.status);

console.log("--- DASHBOARDS (indicadores / painel / catálogo) ---");
const indicadores = await req(sensei, "GET", "/esportivo/indicadores");
caso("sensei -> indicadores", 200, indicadores.status);
caso("indicadores.graduacoesPorMes é array", true, Array.isArray(indicadores.json?.graduacoesPorMes));
caso(
  "indicadores.frequenciaPorModalidade é array",
  true,
  Array.isArray(indicadores.json?.frequenciaPorModalidade),
);
caso(
  "indicadores.evasaoPorModalidade é array",
  true,
  Array.isArray(indicadores.json?.evasaoPorModalidade),
);
// A graduação Faixa Cinza concedida acima entra na contagem do mês corrente.
const totalGrad = (indicadores.json?.graduacoesPorMes ?? []).reduce((s, m) => s + m.total, 0);
caso("graduações do período >= 1", true, totalGrad >= 1);
// A trilha de chave da agregação: presença selada lançada acima existe.
caso(
  "frequenciaPorModalidade tem entrada (chamada selada)",
  true,
  (indicadores.json?.frequenciaPorModalidade ?? []).length >= 1,
);
// Frequência agora destrincha atrasos/faltas (B2 — polimento read/agregação).
const freqJudo = (indicadores.json?.frequenciaPorModalidade ?? []).find(
  (f) => f.modalidade === "Judô",
);
caso("frequência por modalidade expõe atrasos", true, freqJudo != null && typeof freqJudo.atrasos === "number");
caso("frequência por modalidade expõe faltas", true, freqJudo != null && typeof freqJudo.faltas === "number");
// O treino selado tinha 1 PRESENTE → presencas (compareceu) >= 1.
caso("frequência conta quem compareceu", true, !!freqJudo && freqJudo.presencas >= 1);

const painel = await req(sensei, "GET", "/esportivo/painel");
caso("sensei -> painel", 200, painel.status);
caso("painel.ocupacao presente", true, painel.json?.ocupacao != null);
caso("painel.emQuadraHoje é array", true, Array.isArray(painel.json?.emQuadraHoje));
caso("painel.proximosExames é array", true, Array.isArray(painel.json?.proximosExames));
// O treino registrado hoje (acima) tem de aparecer em quadra hoje.
caso(
  "treino de hoje aparece em quadra",
  true,
  (painel.json?.emQuadraHoje ?? []).some((t) => t.turmaId === turma.json.id),
);
// C2 — painel enriquecido: ocupação por modalidade + demanda reprimida.
caso("painel.ocupacaoPorModalidade é array", true, Array.isArray(painel.json?.ocupacaoPorModalidade));
caso("painel.listaEsperaTotal numérico", "number", typeof painel.json?.listaEsperaTotal);
// A turma de Judô criada está EM_ANDAMENTO com 1 atleta ativo → Judô tem de
// aparecer no agregado por modalidade com o shape completo.
const ocJudo = (painel.json?.ocupacaoPorModalidade ?? []).find((m) => m.modalidade === "Judô");
caso("ocupacaoPorModalidade traz Judô (turma em quadra)", true, ocJudo != null);
caso(
  "ocupacaoPorModalidade tem shape completo",
  true,
  ocJudo != null &&
    typeof ocJudo.turmas === "number" &&
    typeof ocJudo.atletasAtivos === "number" &&
    typeof ocJudo.vagasTotais === "number" &&
    "pct" in ocJudo,
);
caso("Judô conta o atleta ativo da turma", true, !!ocJudo && ocJudo.atletasAtivos >= 1);

const catalogo = await req(sensei, "GET", "/esportivo/catalogo");
caso("sensei -> catálogo (sem filtro)", 200, catalogo.status);
caso("catálogo.items é array", true, Array.isArray(catalogo.json?.items));
caso("catálogo.grade é array", true, Array.isArray(catalogo.json?.grade));
caso("catálogo.total numérico", "number", typeof catalogo.json?.total);
caso("catálogo inclui a turma criada", true, (catalogo.json?.items ?? []).some((t) => t.id === turma.json.id));
// C2 — catálogo enriquecido: resumo (por status/modalidade/lotadas) + flag lotada.
caso("catálogo.resumo presente", true, catalogo.json?.resumo != null);
caso(
  "resumo.porStatus tem as 3 situações",
  true,
  catalogo.json?.resumo != null &&
    typeof catalogo.json.resumo.porStatus?.EM_ANDAMENTO === "number" &&
    typeof catalogo.json.resumo.porStatus?.INSCRICOES_ABERTAS === "number" &&
    typeof catalogo.json.resumo.porStatus?.ENCERRADA === "number",
);
caso("resumo.porModalidade é array", true, Array.isArray(catalogo.json?.resumo?.porModalidade));
caso("resumo.lotadas numérico", "number", typeof catalogo.json?.resumo?.lotadas);
// A turma JUDO criada tem 1 vaga e 1 atleta ativo → tem de vir marcada lotada.
const minhaTurmaCat = (catalogo.json?.items ?? []).find((t) => t.id === turma.json.id);
caso("item do catálogo expõe flag lotada", true, minhaTurmaCat != null && typeof minhaTurmaCat.lotada === "boolean");
caso("turma de 1 vaga com 1 atleta está lotada", true, !!minhaTurmaCat && minhaTurmaCat.lotada === true);
// Soma por status do resumo bate com o total do catálogo (consistência).
const somaStatus = catalogo.json?.resumo
  ? catalogo.json.resumo.porStatus.EM_ANDAMENTO +
    catalogo.json.resumo.porStatus.INSCRICOES_ABERTAS +
    catalogo.json.resumo.porStatus.ENCERRADA
  : -1;
caso("resumo.porStatus soma = total", catalogo.json?.total, somaStatus);

const catalogoFiltrado = await req(sensei, "GET", `/esportivo/catalogo?modalidadeId=${judo.id}`);
caso("catálogo filtrado por modalidade", 200, catalogoFiltrado.status);
caso(
  "filtro só traz a modalidade pedida",
  true,
  (catalogoFiltrado.json?.items ?? []).every((t) => t.modalidade.id === judo.id),
);

const catalogoEncerradas = await req(sensei, "GET", "/esportivo/catalogo?status=ENCERRADA");
caso("catálogo filtrado por status", 200, catalogoEncerradas.status);
caso(
  "filtro de status só traz ENCERRADA",
  true,
  (catalogoEncerradas.json?.items ?? []).every((t) => t.status === "ENCERRADA"),
);

console.log("--- RBAC CRUZADO ---");
const medicoNega = await req(medico, "GET", "/esportivo/turmas");
caso("médico -> esportivo (parede de tenant)", 403, medicoNega.status);
const familiaNega = await req(familia, "POST", `/esportivo/matriculas/${m1.json.id}/graduacoes`, {
  nivel: "Faixa Azul",
});
caso("família -> graduar (RBAC)", 403, familiaNega.status);
// Os dashboards são dado sensível agregado — família não pode lê-los.
const familiaIndicadores = await req(familia, "GET", "/esportivo/indicadores");
caso("família -> indicadores (RBAC)", 403, familiaIndicadores.status);
const familiaPainel = await req(familia, "GET", "/esportivo/painel");
caso("família -> painel (RBAC)", 403, familiaPainel.status);
const familiaCatalogo = await req(familia, "GET", "/esportivo/catalogo");
caso("família -> catálogo (RBAC)", 403, familiaCatalogo.status);

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
