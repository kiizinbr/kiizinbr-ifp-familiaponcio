import type { RoleAssignment } from "@/lib/rbac-types";

export const UNIDADE_SLUGS = [
  "medico",
  "capacitacao",
  "esportivo",
  "recreativo",
  "poncio",
  "social",
] as const;

export type UnidadeSlug = (typeof UNIDADE_SLUGS)[number];

export interface UnidadeConfig {
  slug: UnidadeSlug;
  nome: string;
  /** Frase institucional curta exibida no hero do login (layout Split). */
  tagline?: string;
  /** Hex do filtro temático aplicado como overlay sobre a foto de fundo do login. */
  corFiltroLogin: string;
  /** Path em /public da foto de fundo (drone ou institucional). null = usa gradiente. */
  fotoFundoLogin: string | null;
  /** Gradiente CSS fallback quando fotoFundoLogin é null. */
  gradienteFallback: string;
  rolesAceitas: readonly RoleAssignment[];
  cidadaoScope: "self" | "all";
}

/**
 * Config canônica das unidades. Cores extraídas do Brandbook IFP oficial
 * (2026-05-28). Mapeamento temático aprovado: cada unidade recebe um tom
 * da paleta institucional como filtro de login (overlay sobre a foto).
 * super_admin é tratado fora de rolesAceitas (bypassa em canAccessUnidade).
 */
export const UNIDADES: Record<UnidadeSlug, UnidadeConfig> = {
  medico: {
    slug: "medico",
    nome: "Centro Médico",
    tagline: "Cuidado que começa no bairro.",
    corFiltroLogin: "#007571", // teal escuro — saúde/cuidado
    fotoFundoLogin: "/unidades/medico.jpg",
    gradienteFallback: "linear-gradient(135deg, #007571, #10C2BB)",
    rolesAceitas: [
      { name: "gestor_unidade", unitScope: "medico" },
      { name: "profissional", unitScope: "medico" },
      { name: "recepcao", unitScope: "medico" },
      { name: "painel", unitScope: "medico" },
    ],
    cidadaoScope: "self",
  },
  capacitacao: {
    slug: "capacitacao",
    nome: "Capacitação",
    tagline: "Aprender é mudar de vida.",
    corFiltroLogin: "#FF772E", // laranja vibrante — aprendizado/energia
    fotoFundoLogin: null,
    gradienteFallback: "linear-gradient(135deg, #FF772E, #C24D0F)",
    rolesAceitas: [
      { name: "gestor_unidade", unitScope: "capacitacao" },
      { name: "profissional", unitScope: "capacitacao" },
      { name: "recepcao", unitScope: "capacitacao" },
      { name: "painel", unitScope: "capacitacao" },
    ],
    cidadaoScope: "self",
  },
  esportivo: {
    slug: "esportivo",
    nome: "Esportivo",
    tagline: "Movimento que transforma.",
    corFiltroLogin: "#C24D0F", // laranja escuro — movimento
    fotoFundoLogin: null,
    gradienteFallback: "linear-gradient(135deg, #C24D0F, #752C05)",
    rolesAceitas: [
      { name: "gestor_unidade", unitScope: "esportivo" },
      { name: "profissional", unitScope: "esportivo" },
      { name: "recepcao", unitScope: "esportivo" },
    ],
    cidadaoScope: "self",
  },
  recreativo: {
    slug: "recreativo",
    nome: "Recreativo",
    tagline: "Onde a infância floresce.",
    corFiltroLogin: "#10C2BB", // teal claro — alegria/leveza
    fotoFundoLogin: null,
    gradienteFallback: "linear-gradient(135deg, #10C2BB, #007571)",
    rolesAceitas: [
      { name: "gestor_unidade", unitScope: "recreativo" },
      { name: "profissional", unitScope: "recreativo" },
      { name: "recepcao", unitScope: "recreativo" },
    ],
    cidadaoScope: "self",
  },
  poncio: {
    slug: "poncio",
    nome: "Pôncio Executivo",
    tagline: "A visão de quem cuida de tudo.",
    corFiltroLogin: "#752C05", // marrom — sobriedade executiva
    fotoFundoLogin: null,
    gradienteFallback: "linear-gradient(135deg, #752C05, #4A4A49)",
    rolesAceitas: [{ name: "presidencia", unitScope: null }],
    cidadaoScope: "all",
  },
  social: {
    slug: "social",
    nome: "Serviço Social",
    tagline: "Acolher é o primeiro passo.",
    corFiltroLogin: "#4A4A49", // cinza — transversal
    fotoFundoLogin: null,
    gradienteFallback: "linear-gradient(135deg, #4A4A49, #6B6B6B)",
    rolesAceitas: [{ name: "social", unitScope: null }],
    cidadaoScope: "all",
  },
};

export function unidadeFromSlug(slug: string): UnidadeConfig | null {
  return (UNIDADES as Record<string, UnidadeConfig>)[slug] ?? null;
}

/**
 * Unidade tem painel de fila? So as operacionais (cidadaoScope "self":
 * medico/capacitacao/esportivo/recreativo). poncio/social ("all") nao geram fila
 * propria -> painel abriria vazio. Fonte unica derivada da config, sem lista paralela.
 */
export function isUnidadePainel(slug: string): boolean {
  const u = unidadeFromSlug(slug);
  return u !== null && u.cidadaoScope === "self";
}

/**
 * Slugs de unidades em que essas roles conseguem entrar.
 * super_admin → todas.
 */
export function unidadesAcessiveis(roles: readonly RoleAssignment[]): UnidadeSlug[] {
  if (roles.some((r) => r.name === "super_admin")) {
    return [...UNIDADE_SLUGS];
  }
  const acessiveis: UnidadeSlug[] = [];
  for (const slug of UNIDADE_SLUGS) {
    const aceitas = UNIDADES[slug].rolesAceitas;
    const match = roles.some((userRole) =>
      aceitas.some(
        (aceita) => aceita.name === userRole.name && aceita.unitScope === userRole.unitScope,
      ),
    );
    if (match) acessiveis.push(slug);
  }
  return acessiveis;
}
