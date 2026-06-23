/**
 * Mapa das unidades ("salões" na direção CASA) para o fluxo público de acesso:
 * vitrine na home → escolha em /acesso → /login?unidade=<slug> (login temático)
 * → pós-login cai direto no destino da unidade.
 */
export interface UnidadeAcesso {
  slug: string;
  nome: string;
  descricao: string;
  /** data-theme que troca o trio --unidade/* (tokens.css). */
  tema: string;
  /** Rota da área após o login. */
  destino: string;
  /** Barra de cor da vitrine institucional. */
  cor: string;
  /** Unidade de atendimento (aparece na vitrine pública). */
  atendimento: boolean;
}

export const UNIDADES_ACESSO: UnidadeAcesso[] = [
  {
    slug: "medico",
    nome: "Centro Médico",
    descricao: "Atendimento médico filantrópico em diversas especialidades.",
    tema: "medico",
    destino: "/medico",
    cor: "bg-ifp-teal-bright",
    atendimento: true,
  },
  {
    slug: "capacitacao",
    nome: "Centro de Capacitação",
    descricao: "Cursos gratuitos para inserção no mercado de trabalho.",
    tema: "capacitacao",
    destino: "/capacitacao",
    cor: "bg-ifp-orange",
    atendimento: true,
  },
  {
    slug: "esportivo",
    nome: "Centro Esportivo",
    descricao: "Modalidades esportivas com graduações verificáveis.",
    tema: "esportivo",
    destino: "/esportivo",
    cor: "bg-ifp-orange-deep",
    atendimento: true,
  },
  {
    slug: "educacional",
    nome: "Centro Educacional",
    descricao: "Educação infantil com diário do dia e comunicados às famílias.",
    tema: "educacional",
    destino: "/educacional",
    cor: "bg-ifp-teal-deep",
    atendimento: true,
  },
  {
    slug: "servico-social",
    nome: "Serviço Social",
    descricao: "Fichas Cidadãs, elegibilidade e acompanhamento das famílias.",
    tema: "servico-social",
    destino: "/servico-social",
    cor: "bg-ifp-gray-700",
    atendimento: false,
  },
  {
    slug: "familia",
    nome: "Portal da Família",
    descricao: "Diário do dia, comunicados e ficha da criança.",
    tema: "educacional",
    destino: "/familia",
    cor: "bg-ifp-teal-deep",
    atendimento: false,
  },
];

export function unidadePorSlug(slug: string | null): UnidadeAcesso | undefined {
  if (!slug) return undefined;
  return UNIDADES_ACESSO.find((u) => u.slug === slug);
}

/**
 * Rota de destino do salão a partir do slug da unidade (usada pelo seletor
 * pós-login). Default seguro: a tela de "Minha conta", que qualquer perfil
 * acessa, caso o slug não tenha um destino mapeado.
 */
export function destinoPorSlug(slug: string): string {
  return unidadePorSlug(slug)?.destino ?? "/conta";
}
