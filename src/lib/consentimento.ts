/**
 * LGPD base legal — estado de consentimento do cidadão (puro). Versionado: o termo
 * tem uma versão; se a pessoa consentiu numa versão antiga, fica "desatualizado"
 * (precisa re-registrar). Imagem é granular (interno/redes/imprensa).
 */

export const VERSAO_TERMO_TRATAMENTO = "v1-2026-06";
export const VERSAO_TERMO_IMAGEM = "v1-2026-06";

export type TipoConsentimento = "tratamento_dados" | "imagem";

export interface ConsentimentoRec {
  tipo: TipoConsentimento;
  versao: string;
  imagemInterno: boolean;
  imagemRedes: boolean;
  imagemImprensa: boolean;
  revogadoEm: Date | null;
}

export interface StatusConsentimento {
  tratamento: { vigente: boolean; versao: string | null; desatualizado: boolean };
  imagem: {
    interno: boolean;
    redes: boolean;
    imprensa: boolean;
    versao: string | null;
    desatualizado: boolean;
  };
}

/** Deriva o estado de exibição a partir dos registros de consentimento do cidadão. */
export function statusConsentimento(recs: readonly ConsentimentoRec[]): StatusConsentimento {
  const trat = recs.find((r) => r.tipo === "tratamento_dados");
  const img = recs.find((r) => r.tipo === "imagem");
  const tratVigente = !!trat && trat.revogadoEm == null;
  return {
    tratamento: {
      vigente: tratVigente,
      versao: trat?.versao ?? null,
      desatualizado: tratVigente && trat.versao !== VERSAO_TERMO_TRATAMENTO,
    },
    imagem: {
      interno: !!img && img.imagemInterno,
      redes: !!img && img.imagemRedes,
      imprensa: !!img && img.imagemImprensa,
      versao: img?.versao ?? null,
      desatualizado: !!img && img.versao !== VERSAO_TERMO_IMAGEM,
    },
  };
}
