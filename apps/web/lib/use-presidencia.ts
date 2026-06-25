"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import { useAuthFetch } from "./use-auth-fetch";

// ============================================================
// Tipos das respostas (espelham o PresidenciaService no NestJS)
// ============================================================

export type TipoUnidade = "MEDICO" | "CAPACITACAO" | "ESPORTIVO" | "EDUCACIONAL";

export interface ResumoPresidencia {
  familiasAtivas: number;
  familiasAtendidas: number;
  pessoasImpactadas: number;
  novasFichasMes: number;
  atendimentosMes: number;
  matriculasAtivas: number;
  certificados: number;
  graduacoes: number;
  unidadesAtivas: number;
  profissionaisAtivos: number;
}

export interface FamiliasPresidencia {
  total: number;
  inativas: number;
  novasMes: number;
  pessoasImpactadas: number;
  situacao: { aprovadas: number; emTriagem: number; inativas: number };
  porBairro: { bairro: string; total: number }[];
  perfilSocio: {
    comDados: number;
    rendaPerCapitaMedia: number | null;
    recebeBolsaFamilia: number;
    recebeBPC: number;
    moradia: { situacao: string; total: number }[];
  };
  faixaEtaria: { faixa: string; total: number }[];
}

export interface UnidadePulso {
  tipo: TipoUnidade;
  nome: string;
  slug: string;
  modo: "capacidade" | "volume";
  vagas: number | null;
  ativos: number | null;
  listaEspera: number | null;
  ocupacaoPct: number | null;
  beneficiarios?: number;
  agendamentosAtivos: number | null;
  atendimentosMes: number | null;
}

export interface UnidadesPresidencia {
  kpis: {
    ocupacaoMedia: number | null;
    vagasPreenchidas: number;
    listaEspera: number;
    sobPressao: number;
  };
  unidades: UnidadePulso[];
}

export interface ImpactoPresidencia {
  kpis: { familiasAtendidas: number; atendimentosMes: number };
  serieFamilias: { mes: string; total: number }[];
  serieAtendimentos: { mes: string; total: number }[];
  crescimentoPorUnidade: { tipo: string; nome: string; total: number }[];
}

export interface SerieMensalPonto {
  mes: string;
  total: number;
}

export interface SerieImpacto {
  chave: "atendimentos" | "matriculas" | "graduacoes" | "certificados" | "presencas";
  label: string;
  pontos: SerieMensalPonto[];
}

export interface ImpactoSeriesPresidencia {
  meses: number;
  kpis: {
    atendimentos: number;
    matriculas: number;
    graduacoes: number;
    certificados: number;
    presencas: number;
  };
  series: SerieImpacto[];
}

export interface JornadaPresidencia {
  familiasUnicas: number;
  cross2mais: number;
  cross3mais: number;
  quatroUnidades: number;
  distribuicao: { unidades: number; total: number }[];
  pontes: { tipo_a: string; tipo_b: string; total: number }[];
  constelacoes: { codigo: string; pessoas: number; unidades: string[] }[];
}

export interface TerritorioPresidencia {
  tipo: "distribuicao-por-bairro";
  totalFamilias: number;
  familiasComBairro: number;
  bairrosDistintos: number;
  porBairro: { bairro: string; total: number }[];
  porCidade: { cidade: string; total: number }[];
  porBairroUnidade: {
    bairro: string;
    unidades: { tipo: string; total: number }[];
  }[];
}

export interface SaudePopulacional {
  tipo: "saude-populacional";
  kpis: {
    condicoesAtivas: number;
    alergiasAtivas: number;
    triagens: number;
    atendimentosSelados: number;
    pessoasSobCuidado: number;
  };
  totais: { pessoasComCondicao: number; pessoasComAlergia: number };
  faixaEtaria: { faixa: string; total: number }[];
  porCondicao: { descricao: string; cid10: string | null; total: number }[];
  alergiasPorGravidade: { gravidade: string; total: number }[];
  triagensPorRisco: { risco: string; total: number }[];
  porCid10: { cid10: string; total: number }[];
  porBairro: { bairro: string; total: number }[];
}

// ============================================================
// Queries
// ============================================================

function usePresidenciaQuery<T>(secao: string) {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["presidencia", secao],
    queryFn: () => authFetch<T>(`/presidencia/${secao}`),
    enabled: status === "authenticated",
  });
}

export const useResumoPresidencia = () => usePresidenciaQuery<ResumoPresidencia>("resumo");
export const useFamiliasPresidencia = () => usePresidenciaQuery<FamiliasPresidencia>("familias");
export const useUnidadesPresidencia = () => usePresidenciaQuery<UnidadesPresidencia>("unidades");
export const useImpactoPresidencia = () => usePresidenciaQuery<ImpactoPresidencia>("impacto");
export const useJornadaPresidencia = () => usePresidenciaQuery<JornadaPresidencia>("jornada");
export const useTerritorioPresidencia = () =>
  usePresidenciaQuery<TerritorioPresidencia>("territorio");
export const useSaudePresidencia = () => usePresidenciaQuery<SaudePopulacional>("saude");

/** Séries temporais cruzando as verticais; `meses` entre 3 e 24 (default 12). */
export function useImpactoSeries(meses: number) {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["presidencia", "impacto-series", meses],
    queryFn: () =>
      authFetch<ImpactoSeriesPresidencia>(`/presidencia/impacto-series?meses=${meses}`),
    enabled: status === "authenticated",
    placeholderData: (prev) => prev,
  });
}

export type PeriodoChave = "mes" | "ano" | "12m";

export interface PrestacaoContas {
  periodo: { chave: PeriodoChave; label: string; inicio: string };
  novas: { familias: number; matriculas: number };
  realizados: { atendimentos: number; certificados: number; graduacoes: number };
  base: {
    familiasAtendidas: number;
    pessoasImpactadas: number;
    familiasUnicas: number;
    cross2mais: number;
    cross2maisPct: number;
  };
}

export function usePrestacaoContas(periodo: PeriodoChave) {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["presidencia", "prestacao-contas", periodo],
    queryFn: () =>
      authFetch<PrestacaoContas>(`/presidencia/prestacao-contas?periodo=${periodo}`),
    enabled: status === "authenticated",
    placeholderData: (prev) => prev,
  });
}

// ============================================================
// Relatórios institucionais selados (model RelatorioPDF)
// ============================================================

export type TipoRelatorio = "PRESTACAO_CONTAS" | "IMPACTO";

export interface RelatorioItem {
  id: string;
  tipo: TipoRelatorio;
  tipoLabel: string;
  periodo: PeriodoChave;
  titulo: string;
  geradoPorNome: string;
  geradoEm: string;
  codigo: string;
}

export interface ListaRelatorios {
  total: number;
  itens: RelatorioItem[];
}

export function useRelatorios() {
  const authFetch = useAuthFetch();
  const { status } = useSession();
  return useQuery({
    queryKey: ["presidencia", "relatorios"],
    queryFn: () => authFetch<ListaRelatorios>("/presidencia/relatorios"),
    enabled: status === "authenticated",
  });
}

/** Gera um novo relatório selado e invalida a lista para refletir na hora. */
export function useGerarRelatorio() {
  const authFetch = useAuthFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { tipo: TipoRelatorio; periodo: PeriodoChave }) =>
      authFetch<RelatorioItem>("/presidencia/relatorios", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["presidencia", "relatorios"] });
    },
  });
}

export const TIPO_RELATORIO_LABEL: Record<TipoRelatorio, string> = {
  PRESTACAO_CONTAS: "Prestação de Contas",
  IMPACTO: "Relatório de Impacto",
};

export const PERIODO_RELATORIO_LABEL: Record<PeriodoChave, string> = {
  mes: "Este mês",
  ano: "Este ano",
  "12m": "Últimos 12 meses",
};

// ============================================================
// Rótulos e cores das unidades (paleta oficial dos tokens CASA)
// ============================================================

export const UNIDADE_LABEL: Record<string, string> = {
  MEDICO: "Centro Médico",
  CAPACITACAO: "Capacitação",
  ESPORTIVO: "Centro Esportivo",
  EDUCACIONAL: "Recreativo / Creche",
};

export const UNIDADE_COR: Record<string, string> = {
  MEDICO: "#10C2BB",
  CAPACITACAO: "#FF772E",
  ESPORTIVO: "#9A3D0B",
  EDUCACIONAL: "#007571",
};

// Cores da classificação de risco da triagem (protocolo de acolhimento).
export const RISCO_COR: Record<string, string> = {
  VERMELHO: "#DC2626",
  LARANJA: "#EA580C",
  AMARELO: "#CA8A04",
  VERDE: "#16A34A",
  AZUL: "#2563EB",
};

// Cores da gravidade da alergia.
export const GRAVIDADE_COR: Record<string, string> = {
  GRAVE: "#DC2626",
  MODERADA: "#EA580C",
  LEVE: "#CA8A04",
  "Não classificada": "#94A3B8",
};
