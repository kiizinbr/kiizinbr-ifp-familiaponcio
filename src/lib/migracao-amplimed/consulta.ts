import type { ConsultaRow, NotaMapeada } from "./tipos";
import { parseCid10Texto } from "./cid10";

const HORA_INICIO = 8; // 08:00 base sintética

/** dataHoraInicio determinístico p/ Slot, sem colidir por (prof, dia). ordemNoDia >= 0. */
export function horaSinteticaSlot(dia: Date, ordemNoDia: number, duracaoMin: number): Date {
  const base = Date.UTC(
    dia.getUTCFullYear(),
    dia.getUTCMonth(),
    dia.getUTCDate(),
    HORA_INICIO,
    0,
    0,
  );
  return new Date(base + ordemNoDia * duracaoMin * 60_000);
}

function bloco(titulo: string, corpo: string | null): string {
  return corpo && corpo.trim() ? `${titulo}: ${corpo.trim()}` : "";
}

// Vitais da Amplimed vêm sujos (ex.: peso=7000 = gramas → estoura Decimal(5,2)).
// Sanitiza p/ caber na coluna e descartar lixo; fora de faixa/≤0 → null (não inventa).

/** Decimal arredondado à escala da coluna; descarta o que estouraria (3 díg. inteiros). */
function decimalSeguro(v: number | null, casas: number): number | null {
  if (v == null || v <= 0) return null;
  const f = 10 ** casas;
  const r = Math.round(v * f) / f;
  return r < 1000 ? r : null;
}

/** Inteiro positivo plausível; descarta ≤0 e absurdos (anti-overflow Int4). */
function intSeguro(v: number | null): number | null {
  if (v == null || v <= 0) return null;
  const r = Math.round(v);
  return r < 100000 ? r : null;
}

export function mapConsultaParaNota(row: ConsultaRow): NotaMapeada {
  const texto = [
    bloco("Queixa", row.queixa),
    bloco("Antecedentes", row.anteceden),
    bloco("Exame físico", row.descfis),
    bloco("Conduta", row.conduta),
    bloco("Medicações", row.meds),
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    codcon: row.codcon,
    texto: texto || "(migrado da Amplimed — sem texto)",
    paSistolica: intSeguro(row.pas),
    paDiastolica: intSeguro(row.pad),
    fcBpm: intSeguro(row.freqcar),
    frIrpm: intSeguro(row.freqres),
    tempC: decimalSeguro(row.tempe, 1),
    pesoKg: decimalSeguro(row.peso, 2),
    alturaCm: intSeguro(row.altura),
    diagnosticos: parseCid10Texto(row.cid10),
  };
}
