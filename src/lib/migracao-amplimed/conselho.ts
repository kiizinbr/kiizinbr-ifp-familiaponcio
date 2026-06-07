// Limpeza do conselho/registro profissional vindo sujo da Amplimed.
// Junk real observado: "2222...2222" (dígito repetido), "05&#x2F;68179" (entidade
// HTML = "/"), "52-0131605-2&amp;amp;#x2F;RJ" (tripla codificação), "0000000013358
// RJ" (espaços + UF embutida). Decisão 2026-06-07 (checkpoint Erick).

/** Decodifica entidades HTML repetidamente (cobre dupla/tripla codificação). */
export function decodeEntidadesHtml(input: string | null): string {
  let s = input ?? "";
  let prev = "";
  while (s !== prev) {
    prev = s;
    s = s
      .replace(/&amp;/gi, "&")
      .replace(/&#x([0-9a-f]+);/gi, (_m, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_m, dec: string) => String.fromCodePoint(parseInt(dec, 10)));
  }
  return s;
}

/** Sigla do conselho (CRM/CRP/CRO/CRN/CRFA/COREN/CRESS…). Lixo → "". */
export function limparConselho(raw: string | null): string {
  const s = decodeEntidadesHtml(raw).replace(/\s+/g, " ").trim().toUpperCase();
  return /^[A-ZÇ]{2,8}$/.test(s) ? s : "";
}

/** Nº de registro. Remove entidades, espaços e UF redundante no fim; lixo → "". */
export function limparRegistro(raw: string | null, uf: string | null): string {
  let s = decodeEntidadesHtml(raw).replace(/\s+/g, " ").trim();
  const ufNorm = (uf ?? "").trim().toUpperCase();
  if (ufNorm) {
    // remove UF redundante no FIM (registrouf já guarda a UF separada)
    s = s.replace(new RegExp(`[\\s/\\-]*${ufNorm}$`, "i"), "").trim();
  }
  if (!s) return "";
  const digitos = s.replace(/\D/g, "");
  if (digitos && /^0+$/.test(digitos)) return ""; // só zeros
  if (digitos && /^(\d)\1{5,}$/.test(digitos)) return ""; // mesmo dígito 6+ (lixo)
  return s;
}
