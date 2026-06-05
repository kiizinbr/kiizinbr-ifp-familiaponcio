import { randomBytes, createHash } from "node:crypto";

/**
 * Núcleo do reset de senha (admin-driven, Fase 1 / Identidade). O token raw de alta
 * entropia vai no link entregue à pessoa; o banco guarda só o HASH (sha256) — assim
 * um vazamento do banco não expõe tokens utilizáveis. Uso único + TTL curto.
 */

export const RESET_TOKEN_TTL_MIN = 60;

/** Token raw (hex de 32 bytes) — vai no link, NUNCA é persistido. */
export function gerarTokenRaw(): string {
  return randomBytes(32).toString("hex");
}

/** Hash (sha256) do token — o que vai pro banco. Determinístico. */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Pura: o token está expirado em relação a `agora`? (>= é expirado). */
export function tokenExpirado(expiresAt: Date, agora: Date): boolean {
  return agora.getTime() >= expiresAt.getTime();
}
