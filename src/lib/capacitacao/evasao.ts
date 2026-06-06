/**
 * Risco de evasão (F1.A.2+): alerta pra secretaria/coordenação agir antes de perder
 * o aluno. Puro. Dispara por frequência acumulada baixa OU faltas seguidas no fim da
 * série. Números ajustáveis (decisão institucional).
 */
export const LIMITE_FREQUENCIA_RISCO = 75;
export const MAX_FALTAS_CONSECUTIVAS = 3;

export interface RiscoEvasao {
  emRisco: boolean;
  percentual: number;
  faltasConsecutivas: number;
  /** Vazio quando não há risco; senão, os motivos (ex.: "Frequência 60%", "3 faltas seguidas"). */
  motivos: string[];
}

/**
 * Avalia o risco a partir das presenças ORDENADAS por data (mais antiga → recente).
 * - frequência: só conta a partir de MAX_FALTAS_CONSECUTIVAS aulas (evita falso alarme
 *   nas primeiras aulas, quando 1 falta vira 0%).
 * - faltas seguidas: conta a sequência de faltas no FIM da série (sumiço recente).
 */
export function avaliarRiscoEvasao(
  presencasOrdenadas: readonly { presente: boolean }[],
): RiscoEvasao {
  const total = presencasOrdenadas.length;
  const presentes = presencasOrdenadas.filter((x) => x.presente).length;
  const percentual = total > 0 ? Math.round((presentes / total) * 100) : 0;

  let faltasConsecutivas = 0;
  for (let i = total - 1; i >= 0; i--) {
    if (presencasOrdenadas[i]!.presente) break;
    faltasConsecutivas++;
  }

  const motivos: string[] = [];
  if (total >= MAX_FALTAS_CONSECUTIVAS && percentual < LIMITE_FREQUENCIA_RISCO) {
    motivos.push(`Frequência ${percentual}%`);
  }
  if (faltasConsecutivas >= MAX_FALTAS_CONSECUTIVAS) {
    motivos.push(`${faltasConsecutivas} faltas seguidas`);
  }

  return { emRisco: motivos.length > 0, percentual, faltasConsecutivas, motivos };
}
