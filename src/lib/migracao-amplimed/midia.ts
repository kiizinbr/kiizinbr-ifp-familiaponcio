// Helpers puros p/ migração de mídia Amplimed (T15).
// Os campos de mídia (pacientes.fotopac, pacsimg.endimg) guardam a URL S3
// COMPLETA; o vínculo com o arquivo dentro do ZIP é o BASENAME (hash.ext).
// Placeholders (default_profile / amplimedimggerais) não são mídia real.

const MIME_POR_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  pdf: "application/pdf",
};

/** true se a URL aponta p/ mídia real (não placeholder, não vazia). */
export function ehUrlMidiaReal(url: string | null): boolean {
  if (!url || !url.trim()) return false;
  const u = url.toLowerCase();
  return !u.includes("default_profile") && !u.includes("amplimedimggerais");
}

/** Último segmento do caminho/URL (ex.: "<hash>.png"). null se vazio. */
export function basenameMidia(url: string | null): string | null {
  if (!url || !url.trim()) return null;
  const semQuery = url.split(/[?#]/)[0] ?? "";
  const seg = semQuery.split("/").filter(Boolean).pop();
  return seg && seg.trim() ? seg.trim() : null;
}

/** Nome sem extensão (p/ casar .jpg↔.jpeg entre URL e ZIP). */
export function stemDeBasename(basename: string | null): string | null {
  if (!basename) return null;
  const i = basename.lastIndexOf(".");
  return i > 0 ? basename.slice(0, i) : basename;
}

/** MIME aceito (PDF/JPG/PNG) a partir do basename; null se extensão não aceita. */
export function mimePorBasename(basename: string | null): string | null {
  if (!basename) return null;
  const ext = basename.split(".").pop()?.toLowerCase() ?? "";
  return MIME_POR_EXT[ext] ?? null;
}
