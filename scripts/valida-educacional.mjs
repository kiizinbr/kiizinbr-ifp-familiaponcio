/**
 * E2E ao vivo da vertical Educacional (blueprint Fase 3, passos 3–6 do §9).
 * Uso: SENHA_DEV=... node scripts/valida-educacional.mjs
 * Cobre: painel, turma, perfil da criança, check-in/out (bloqueio do revogado),
 * rotina + selo do diário, portal da família (ownership) e RBAC cruzado.
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

const educadora = await login("educadora@ifp.local");
const familia = await login("familia@ifp.local");
const medico = await login("medico@ifp.local");

console.log("--- PAINEL E TURMA ---");
const resumo = await req(educadora, "GET", "/educacional/resumo");
caso("educadora -> resumo", 200, resumo.status);
console.log(`    KPIs: ${JSON.stringify(resumo.json)}`);

const turmas = await req(educadora, "GET", "/educacional/turmas");
caso("educadora -> turmas", 200, turmas.status);
const turma = turmas.json?.items?.[0];
if (!turma) throw new Error("Jardim A não encontrado — rode o seed");

const detalhe = await req(educadora, "GET", `/educacional/turmas/${turma.id}`);
caso("educadora -> detalhe da turma", 200, detalhe.status);
const matricula = detalhe.json?.matriculas?.[0];
const membroId = matricula?.membroId;
console.log(`    Ana: ${matricula?.crianca?.nomeCompleto} — estado hoje: ${matricula?.estadoDia}`);

console.log("--- PERFIL DA CRIANÇA / AUTORIZADOS ---");
const perfil = await req(educadora, "GET", `/educacional/criancas/${membroId}`);
caso("educadora -> perfil da Ana", 200, perfil.status);
const autorizados = perfil.json?.autorizados ?? [];
const mae = autorizados.find((a) => a.parentesco === "mãe" && !a.revogadoEm);
const avo = autorizados.find((a) => a.parentesco === "avó" && !a.revogadoEm);
const revogado = autorizados.find((a) => a.revogadoEm);
console.log(
  `    autorizados: ${autorizados.length} (revogado: ${revogado?.nome ?? "nenhum"}) · alergias: ${perfil.json?.crianca?.alergias?.length}`,
);

console.log("--- CHECK-IN/OUT (regra central de segurança) ---");
const checkinRevogado = await req(educadora, "POST", "/educacional/checkins", {
  membroId,
  autorizadoId: revogado.id,
});
caso("check-in com REVOGADO bloqueado", 403, checkinRevogado.status);

const checkoutSemEntrada = await req(educadora, "POST", "/educacional/checkouts", {
  membroId,
  autorizadoId: avo.id,
});
caso("check-out sem check-in no dia", 409, checkoutSemEntrada.status);

const checkin = await req(educadora, "POST", "/educacional/checkins", {
  membroId,
  autorizadoId: mae.id,
});
caso("check-in pela mãe", 201, checkin.status);

const checkinDuplo = await req(educadora, "POST", "/educacional/checkins", {
  membroId,
  autorizadoId: mae.id,
});
caso("check-in duplo bloqueado", 409, checkinDuplo.status);

const checkoutRevogado = await req(educadora, "POST", "/educacional/checkouts", {
  membroId,
  autorizadoId: revogado.id,
});
caso("CHECK-OUT com REVOGADO BLOQUEADO (o teste de ouro)", 403, checkoutRevogado.status);

console.log("--- ROTINA + SELO DO DIÁRIO ---");
const registro = await req(educadora, "POST", `/educacional/diarios/${membroId}/registros`, {
  tipo: "ALIMENTACAO",
  descricao: "Almoço: aceitou bem",
});
caso("lançamento de rotina", 201, registro.status);

const diarioHoje = await req(educadora, "GET", `/educacional/diarios/${membroId}`);
caso("diário do dia (educador)", 200, diarioHoje.status);
const diarioId = diarioHoje.json?.diario?.id;

const familiaDiarioAberto = await req(familia, "GET", `/familia/educacional/diario/${membroId}`);
caso("família NÃO vê diário ABERTO (diario=null)", 200, familiaDiarioAberto.status);
const vazio = familiaDiarioAberto.json?.diario === null;
caso("  -> diario veio null antes do selo", true, vazio);

const fechar = await req(educadora, "PATCH", `/educacional/diarios/${diarioId}/fechar`);
caso("fechar diário", 200, fechar.status);

const registroPosSelo = await req(educadora, "POST", `/educacional/diarios/${membroId}/registros`, {
  tipo: "OCORRENCIA",
  descricao: "tentativa pós-selo",
});
caso("registro após o selo bloqueado", 409, registroPosSelo.status);

console.log("--- INDICADORES DA CRECHE (U3) ---");
const indicadores = await req(educadora, "GET", "/educacional/indicadores");
caso("educadora -> indicadores", 200, indicadores.status);
const presencaPorDia = indicadores.json?.presencaPorDia ?? [];
caso("  -> presença por dia traz a série de 7 dias", 7, presencaPorDia.length);
const temOcupacao = Array.isArray(indicadores.json?.ocupacaoPorTurma)
  && indicadores.json.ocupacaoPorTurma.length > 0;
caso("  -> ocupação por turma preenchida", true, temOcupacao);
const fechamentoOk = (indicadores.json?.diarios?.fechados ?? 0) >= 1;
caso("  -> diários fechados >= 1 (o selo de Ana)", true, fechamentoOk);
console.log(
  `    presentes hoje: ${presencaPorDia[presencaPorDia.length - 1]?.presentes} · ocupação geral: ${indicadores.json?.ocupacao?.pct}% · fechamento: ${indicadores.json?.diarios?.taxaFechamento}%`,
);

console.log("--- DIÁRIO EM LOTE (U3) ---");
// Ana (membroId) já está com o diário FECHADO: o lote da turma deve PULÁ-LA,
// nunca abortar — e aplicar nos demais. É o teste central do recurso.
const lote = await req(educadora, "POST", `/educacional/turmas/${turma.id}/diarios/lote`, {
  tipo: "ATIVIDADE",
  descricao: "Roda de música com toda a turma",
});
caso("lote na turma inteira", 201, lote.status);
const anaPulada = (lote.json?.pulados ?? []).some((p) => p.membroId === membroId);
caso("  -> Ana (diário selado) foi PULADA, não derrubou o lote", true, anaPulada);
const totalCoberto =
  (lote.json?.aplicados?.length ?? 0) + (lote.json?.pulados?.length ?? 0);
caso("  -> aplicados + pulados = total de alvos", lote.json?.totalAlvos ?? -1, totalCoberto);

const loteFiltrado = await req(educadora, "POST", `/educacional/turmas/${turma.id}/diarios/lote`, {
  tipo: "HIGIENE",
  descricao: "Higiene das mãos",
  membroIds: [membroId],
});
caso("lote filtrado por criança", 201, loteFiltrado.status);

const loteForaDaTurma = await req(educadora, "POST", `/educacional/turmas/${turma.id}/diarios/lote`, {
  tipo: "HIGIENE",
  descricao: "criança de outra turma",
  membroIds: ["membro-inexistente-xyz"],
});
caso("lote com criança fora da turma -> 400", 400, loteForaDaTurma.status);

const loteTurmaInexistente = await req(educadora, "POST", "/educacional/turmas/turma-zzz/diarios/lote", {
  tipo: "ATIVIDADE",
  descricao: "turma fantasma",
});
caso("lote em turma inexistente/cross-unidade -> 404", 404, loteTurmaInexistente.status);

console.log("--- PORTAL DA FAMÍLIA (ownership) ---");
const minhas = await req(familia, "GET", "/familia/educacional/criancas");
caso("família -> minhas crianças", 200, minhas.status);

const familiaDiario = await req(familia, "GET", `/familia/educacional/diario/${membroId}`);
caso("família vê diário FECHADO de hoje", 200, familiaDiario.status);
console.log(`    registros visíveis: ${familiaDiario.json?.diario?.registros?.length}`);

const ficha = await req(familia, "GET", `/familia/educacional/ficha/${membroId}`);
caso("família -> ficha da criança", 200, ficha.status);

const comunicados = await req(familia, "GET", "/familia/educacional/comunicados");
caso("família -> comunicados", 200, comunicados.status);
const critico = comunicados.json?.items?.find((c) => c.critico && !c.lidoEm);
if (critico) {
  const leitura = await req(familia, "POST", `/familia/educacional/comunicados/${critico.id}/leitura`);
  caso("confirmação de leitura do crítico", 200, leitura.status);
}

console.log("--- RBAC CRUZADO ---");
caso("médico -> /educacional/resumo", 403, (await req(medico, "GET", "/educacional/resumo")).status);
caso(
  "médico -> /educacional/indicadores",
  403,
  (await req(medico, "GET", "/educacional/indicadores")).status,
);
caso(
  "família -> diário em lote (console da equipe)",
  403,
  (await req(familia, "POST", `/educacional/turmas/${turma.id}/diarios/lote`, {
    tipo: "ATIVIDADE",
    descricao: "tentativa indevida",
  })).status,
);
caso(
  "família -> /educacional/turmas (console da equipe)",
  403,
  (await req(familia, "GET", "/educacional/turmas")).status,
);
caso(
  "educadora -> /familia/educacional/criancas",
  403,
  (await req(educadora, "GET", "/familia/educacional/criancas")).status,
);

const falhas = resultados.filter((r) => !r).length;
console.log(
  falhas === 0 ? ">>> VERTICAL EDUCACIONAL VALIDADA <<<" : `>>> ${falhas} FALHA(S) <<<`,
);
process.exit(falhas === 0 ? 0 : 1);
