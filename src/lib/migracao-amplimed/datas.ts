export interface ResultadoData {
  data: Date | null;
  problema: string | null;
}

/** Aceita 'YYYY-MM-DD' e 'DD/MM/YYYY'. Valida o calendário (UTC, sem hora). */
export function parseDataNascimento(input: string | null): ResultadoData {
  if (!input || !input.trim()) return { data: null, problema: "data ausente" };
  const s = input.trim();
  let ano: number, mes: number, dia: number;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  const br = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
  if (iso) {
    ano = Number(iso[1]);
    mes = Number(iso[2]);
    dia = Number(iso[3]);
  } else if (br) {
    dia = Number(br[1]);
    mes = Number(br[2]);
    ano = Number(br[3]);
  } else {
    return { data: null, problema: `data em formato desconhecido: ${s}` };
  }
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  const valida =
    d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
  if (!valida) return { data: null, problema: `data inválida: ${s}` };
  return { data: d, problema: null };
}
