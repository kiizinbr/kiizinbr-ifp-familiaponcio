import { UNIDADE_SLUGS, UNIDADES, type UnidadeSlug } from "@/lib/unidades";

/**
 * Hub /inicio "Briefing do Plantão" — lógica de apresentação PURA.
 * Sem I/O, sem React, sem Prisma: tudo testável em vitest sem DOM.
 * A page (src/app/inicio/page.tsx) só busca dados e renderiza estes retornos.
 */

/**
 * Hora local de São Paulo (0–23) de um instante.
 * `hourCycle: "h23"` é obrigatório — sem ele, meia-noite pode vir como "24".
 */
export function horaEmSaoPaulo(d: Date): number {
  return Number(
    new Intl.DateTimeFormat("pt-BR", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: "America/Sao_Paulo",
    }).format(d),
  );
}

/** Cumprimento do briefing: 5–11 bom dia, 12–17 boa tarde, resto boa noite. */
export function saudacao(hora: number): string {
  if (hora >= 5 && hora <= 11) return "Bom dia";
  if (hora >= 12 && hora <= 17) return "Boa tarde";
  return "Boa noite";
}

const MS_POR_DIA = 86_400_000;

/**
 * Dia civil de São Paulo como contagem de dias desde a época (Date.UTC do
 * Y-M-D local). `en-CA` formata YYYY-MM-DD, parseável sem ambiguidade.
 */
function diaCivilEmSaoPaulo(d: Date): number {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(d);
  const [ano, mes, dia] = ymd.split("-").map(Number);
  return Date.UTC(ano!, mes! - 1, dia!) / MS_POR_DIA;
}

/**
 * Dias-CALENDÁRIO (America/Sao_Paulo) de espera de uma triagem — não janelas
 * de 24h corridas: aberta ontem à noite e vista hoje cedo conta 1, que é o
 * que "chegou hoje"/"aguarda há N dias" comunica. Clock skew (createdAt no
 * futuro) → 0.
 */
export function diasAguardando(createdAt: Date, agora: Date): number {
  return Math.max(0, diaCivilEmSaoPaulo(agora) - diaCivilEmSaoPaulo(createdAt));
}

/** Rótulo humano da espera na fila ("chegou hoje" / "aguarda há N dias"). */
export function labelEspera(dias: number): string {
  if (dias === 0) return "chegou hoje";
  if (dias === 1) return "aguarda há 1 dia";
  return `aguarda há ${dias} dias`;
}

/** Segmento da manchete; `mono: true` → a page envolve em <strong class="mono">. */
export interface Segmento {
  t: string;
  mono?: true;
}

/**
 * Manchete-frase do briefing. Quem não vê triagem (presidência) recebe SÓ a
 * base — nunca um número que o RBAC dela não enxerga (contagem chegaria 0 e
 * "nenhuma pendente" seria mentira institucional).
 */
export function fraseEstado(args: {
  ativos: number;
  triagens: number;
  veTriagem: boolean;
}): Segmento[] {
  const { ativos, triagens, veTriagem } = args;
  const segmentos: Segmento[] = [
    { t: "O instituto acompanha " },
    { t: String(ativos), mono: true },
    { t: ativos === 1 ? " cidadão ativo nas quatro casas." : " cidadãos ativos nas quatro casas." },
  ];
  if (!veTriagem) return segmentos;

  if (triagens === 0) {
    segmentos.push({ t: " Nenhuma triagem pendente — o dia começa em dia." });
  } else if (triagens === 1) {
    segmentos.push(
      { t: " " },
      { t: "1", mono: true },
      { t: " triagem aguarda decisão do Serviço Social." },
    );
  } else {
    segmentos.push(
      { t: " " },
      { t: String(triagens), mono: true },
      { t: " triagens aguardam decisão do Serviço Social." },
    );
  }
  return segmentos;
}

/** Métrica da coluna direita de uma linha do quadro. `valor: null` → só a nota. */
export interface MetricaCasa {
  valor: string | null;
  nota: string;
}

/** Linha do quadro "As casas, hoje". */
export interface LinhaCasa {
  slug: UnidadeSlug;
  nome: string;
  tagline: string;
  href: string;
  metrica: MetricaCasa;
}

/** Visão de triagem que o quadro precisa pra montar a métrica do Serviço Social. */
export interface TriagemDoQuadro {
  abertas: number;
  veTriagem: boolean;
}

/**
 * Atividade real da Capacitação pro quadro: matrículas em estados ativos
 * (inscrito/confirmado/cursando — STATUS_OCUPA_VAGA) + turmas em andamento.
 * A page busca as contagens; aqui é só apresentação.
 */
export interface CapacitacaoDoQuadro {
  matriculasAtivas: number;
  turmasEmAndamento: number;
}

/**
 * Métrica honesta da Capacitação: alunos chegam por triagem/importação de
 * outras casas, então `Cidadao.unitIdOrigem === "capacitacao"` é um proxy
 * enganoso — mostrava 0 com turmas lotadas. Valor = matrículas ativas; a nota
 * carrega o rótulo + turmas em andamento (singular/plural corretos).
 */
function metricaCapacitacao(c: CapacitacaoDoQuadro): MetricaCasa {
  const matriculas = c.matriculasAtivas === 1 ? "matrícula ativa" : "matrículas ativas";
  const turmas =
    c.turmasEmAndamento === 1
      ? "1 turma em andamento"
      : `${c.turmasEmAndamento} turmas em andamento`;
  return { valor: String(c.matriculasAtivas), nota: `${matriculas} · ${turmas}` };
}

/**
 * Único ponto do quadro que distingue casa por slug — aqui na camada pura e
 * testada, nunca no JSX: o Serviço Social é a casa dona da triagem e a
 * Capacitação mede atividade real (matrículas/turmas), não unitIdOrigem.
 * Quem não vê triagem (presidência) recebe só a nota institucional — nunca um
 * número que o RBAC dela não enxerga. A contagem de Capacitação NÃO é gated:
 * presidência tem leitura global das unidades (canAccessUnidade/getUserUnits),
 * só a triagem é restrita (podeFazerTriagem = social + super_admin).
 */
function metricaDaCasa(
  slug: UnidadeSlug,
  ehAtendimento: boolean,
  porUnidade: ReadonlyMap<string, number>,
  triagem: TriagemDoQuadro,
  capacitacao: CapacitacaoDoQuadro,
): MetricaCasa {
  if (slug === "capacitacao") {
    return metricaCapacitacao(capacitacao);
  }
  if (ehAtendimento) {
    return { valor: String(porUnidade.get(slug) ?? 0), nota: "cidadãos ativos" };
  }
  if (slug === "social") {
    return triagem.veTriagem
      ? { valor: String(triagem.abertas), nota: "triagens em aberto" }
      : { valor: null, nota: "acompanhamento das famílias" };
  }
  return { valor: null, nota: "leitura executiva" };
}

/**
 * Deriva o quadro inteiro do mapa canônico UNIDADES, na ordem de
 * UNIDADE_SLUGS. `cidadaoScope === "self"` → casa de atendimento (com
 * contagem); `"all"` (poncio/social) → transversal.
 */
export function quadroDasCasas(
  porUnidade: ReadonlyMap<string, number>,
  triagem: TriagemDoQuadro,
  capacitacao: CapacitacaoDoQuadro,
): {
  atendimento: LinhaCasa[];
  transversais: LinhaCasa[];
} {
  const atendimento: LinhaCasa[] = [];
  const transversais: LinhaCasa[] = [];
  for (const slug of UNIDADE_SLUGS) {
    const config = UNIDADES[slug];
    const ehAtendimento = config.cidadaoScope === "self";
    const linha: LinhaCasa = {
      slug,
      nome: config.nome,
      tagline: config.tagline ?? "",
      href: `/${slug}`,
      metrica: metricaDaCasa(slug, ehAtendimento, porUnidade, triagem, capacitacao),
    };
    if (ehAtendimento) {
      atendimento.push(linha);
    } else {
      transversais.push(linha);
    }
  }
  return { atendimento, transversais };
}
