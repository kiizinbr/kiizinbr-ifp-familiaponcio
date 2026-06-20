"use client";

import { useQuery } from "@tanstack/react-query";
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

export interface JornadaPresidencia {
  familiasUnicas: number;
  cross2mais: number;
  cross3mais: number;
  quatroUnidades: number;
  distribuicao: { unidades: number; total: number }[];
  pontes: { tipo_a: string; tipo_b: string; total: number }[];
  constelacoes: { codigo: string; pessoas: number; unidades: string[] }[];
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
