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
    paSistolica: row.pas ?? null,
    paDiastolica: row.pad ?? null,
    fcBpm: row.freqcar ?? null,
    frIrpm: row.freqres ?? null,
    tempC: row.tempe ?? null,
    pesoKg: row.peso ?? null,
    alturaCm: row.altura != null ? Math.round(row.altura) : null,
    diagnosticos: parseCid10Texto(row.cid10),
  };
}
