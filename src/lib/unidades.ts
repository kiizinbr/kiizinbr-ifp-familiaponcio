import type { RoleName, UnitScope } from "@/lib/rbac-types";

export const UNIDADE_SLUGS = [
  "medico",
  "capacitacao",
  "esportivo",
  "recreativo",
  "poncio",
  "social",
] as const;

export type UnidadeSlug = (typeof UNIDADE_SLUGS)[number];

export interface RoleAceita {
  name: RoleName;
  unitScope: UnitScope | null;
}

export interface UnidadeConfig {
  slug: UnidadeSlug;
  nome: string;
  corPrimariaPlaceholder: string;
  fotoDronePlaceholder: string | null;
  gradientePlaceholder: string;
  rolesAceitas: readonly RoleAceita[];
  cidadaoScope: "self" | "all";
}

/**
 * Config canônica das unidades. Cores/fotos são placeholders — DS v2 substitui.
 * `rolesAceitas` espelha a matriz role × path da spec (§4.2). super_admin é
 * tratado fora dessa lista (bypassa em unidadesAcessiveis e canAccessUnidade).
 */
export const UNIDADES: Record<UnidadeSlug, UnidadeConfig> = {
  medico: {
    slug: "medico",
    nome: "Centro Médico",
    corPrimariaPlaceholder: "#1e3a8a",
    fotoDronePlaceholder: null,
    gradientePlaceholder: "linear-gradient(135deg, #1e3a8a, #0f766e)",
    rolesAceitas: [
      { name: "gestor_unidade", unitScope: "medico" },
      { name: "profissional", unitScope: "medico" },
      { name: "recepcao", unitScope: "medico" },
    ],
    cidadaoScope: "self",
  },
  capacitacao: {
    slug: "capacitacao",
    nome: "Capacitação",
    corPrimariaPlaceholder: "#7c2d12",
    fotoDronePlaceholder: null,
    gradientePlaceholder: "linear-gradient(135deg, #7c2d12, #a16207)",
    rolesAceitas: [
      { name: "gestor_unidade", unitScope: "capacitacao" },
      { name: "profissional", unitScope: "capacitacao" },
      { name: "recepcao", unitScope: "capacitacao" },
    ],
    cidadaoScope: "self",
  },
  esportivo: {
    slug: "esportivo",
    nome: "Esportivo",
    corPrimariaPlaceholder: "#14532d",
    fotoDronePlaceholder: null,
    gradientePlaceholder: "linear-gradient(135deg, #14532d, #b45309)",
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
    corPrimariaPlaceholder: "#5b21b6",
    fotoDronePlaceholder: null,
    gradientePlaceholder: "linear-gradient(135deg, #5b21b6, #c2410c)",
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
    corPrimariaPlaceholder: "#3f1d0a",
    fotoDronePlaceholder: null,
    gradientePlaceholder: "linear-gradient(135deg, #3f1d0a, #92400e)",
    rolesAceitas: [{ name: "presidencia", unitScope: null }],
    cidadaoScope: "all",
  },
  social: {
    slug: "social",
    nome: "Serviço Social",
    corPrimariaPlaceholder: "#6d28d9",
    fotoDronePlaceholder: null,
    gradientePlaceholder: "linear-gradient(135deg, #6d28d9, #db2777)",
    rolesAceitas: [{ name: "social", unitScope: null }],
    cidadaoScope: "all",
  },
};

export function unidadeFromSlug(slug: string): UnidadeConfig | null {
  return (UNIDADES as Record<string, UnidadeConfig>)[slug] ?? null;
}

/**
 * Slugs de unidades em que essas roles conseguem entrar.
 * super_admin → todas.
 */
export function unidadesAcessiveis(
  roles: readonly { name: RoleName; unitScope: UnitScope | null }[],
): UnidadeSlug[] {
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
