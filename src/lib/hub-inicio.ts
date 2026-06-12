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

/** Dias corridos de espera de uma triagem. Clock skew (createdAt no futuro) → 0. */
export function diasAguardando(createdAt: Date, agora: Date): number {
  return Math.max(0, Math.floor((agora.getTime() - createdAt.getTime()) / MS_POR_DIA));
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

/** Linha do quadro "As casas, hoje". `ativos: null` → linha transversal (sem contagem). */
export interface LinhaCasa {
  slug: UnidadeSlug;
  nome: string;
  tagline: string;
  href: string;
  ativos: number | null;
}

/**
 * Deriva o quadro inteiro do mapa canônico UNIDADES (nada hardcoded), na ordem
 * de UNIDADE_SLUGS. `cidadaoScope === "self"` → casa de atendimento (com
 * contagem); `"all"` (poncio/social) → transversal (ativos: null).
 */
export function quadroDasCasas(porUnidade: ReadonlyMap<string, number>): {
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
      ativos: ehAtendimento ? (porUnidade.get(slug) ?? 0) : null,
    };
    if (ehAtendimento) {
      atendimento.push(linha);
    } else {
      transversais.push(linha);
    }
  }
  return { atendimento, transversais };
}
