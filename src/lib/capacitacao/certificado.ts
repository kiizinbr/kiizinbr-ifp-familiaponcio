import type { StatusMatricula } from "@prisma/client";
import { resumoFrequencia } from "@/lib/capacitacao/presenca";

/** Frequência mínima (%) para emitir certificado de conclusão. */
export const FREQUENCIA_MINIMA_CERTIFICADO = 80;

export interface ElegibilidadeCertificado {
  elegivel: boolean;
  percentual: number;
  /** null quando elegível; mensagem do impedimento caso contrário. */
  motivo: string | null;
}

/**
 * Regra do certificado (F1.A.3): matrícula concluída + frequência >= 80%. Pura —
 * reusa resumoFrequencia. É também a "trava de elegibilidade" da análise de lacunas:
 * impede emitir certificado indevido (concluir alguém com pouca presença).
 */
export function avaliarElegibilidade(
  status: StatusMatricula,
  presencas: readonly { presente: boolean }[],
): ElegibilidadeCertificado {
  const { percentual, total } = resumoFrequencia(presencas);
  if (status !== "concluido") {
    return { elegivel: false, percentual, motivo: "A matrícula precisa estar concluída." };
  }
  if (total === 0) {
    return {
      elegivel: false,
      percentual,
      motivo: "Nenhuma presença registrada para comprovar a frequência.",
    };
  }
  if (percentual < FREQUENCIA_MINIMA_CERTIFICADO) {
    return {
      elegivel: false,
      percentual,
      motivo: `Frequência ${percentual}% — mínimo de ${FREQUENCIA_MINIMA_CERTIFICADO}% não atingido.`,
    };
  }
  return { elegivel: true, percentual, motivo: null };
}

/** Normaliza o código de verificação digitado/lido (trim + maiúsculas, sem espaços). */
export function normalizarCodigo(codigo: string): string {
  return codigo.trim().toUpperCase().replace(/\s+/g, "");
}
