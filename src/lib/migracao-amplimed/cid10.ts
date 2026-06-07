import type { DiagnosticoMapeado } from "./tipos";

const CODIGO = /([A-TV-Z]\d{2}(?:\.\d{1,2})?)/; // formato CID-10

/** Quebra o texto livre de CID da Amplimed em diagnósticos. 1º = principal. */
export function parseCid10Texto(input: string | null): DiagnosticoMapeado[] {
  if (!input || !input.trim()) return [];
  const partes = input
    .split(/[;\n]/)
    .map((p) => p.trim())
    .filter(Boolean);
  const out: DiagnosticoMapeado[] = [];
  for (const parte of partes) {
    const m = CODIGO.exec(parte);
    const codigoCid = m?.[1] ?? null;
    const descricao =
      parte
        .replace(CODIGO, "")
        .replace(/^[\s\-–:]+/, "")
        .trim() ||
      (codigoCid ?? parte);
    out.push({ codigoCid, descricao, principal: out.length === 0 });
  }
  return out;
}
