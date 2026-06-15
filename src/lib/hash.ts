/**
 * F13 — integridade de anexos (LGPD).
 *
 * SHA-256 hex isomórfico: usa Web Crypto (`crypto.subtle`), disponível tanto no
 * browser quanto no Node 20+ (`globalThis.crypto`). Calculado no cliente no
 * upload e validado no boundary do Server Action antes de gravar.
 *
 * Caveat: o hash vem do cliente — resolve dedup + integridade de transporte,
 * NÃO é prova forte contra cliente malicioso. Para isso, hash server-side do
 * objeto no storage (fora do escopo MVP).
 */

/** SHA-256 hex (64 chars minúsculos) é o formato canônico gravado em hashSha256. */
const SHA256_HEX = /^[0-9a-f]{64}$/;

/** Valida o formato do hash no boundary — não confiar no cliente cegamente. */
export function isValidSha256Hex(value: unknown): value is string {
  return typeof value === "string" && SHA256_HEX.test(value);
}

/** Converte bytes em string hex minúscula (helper puro, determinístico). */
export function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, "0");
  }
  return hex;
}

/** SHA-256 de um buffer → hex minúsculo. Funciona no browser e no Node 20+. */
export async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return bytesToHex(new Uint8Array(digest));
}
