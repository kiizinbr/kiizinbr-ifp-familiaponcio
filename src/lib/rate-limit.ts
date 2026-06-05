import { headers } from "next/headers";
import { db } from "@/lib/db";

/**
 * Rate-limit de login (C2) — sliding-window por (email, IP) reusando os eventos
 * `signin_failed` já gravados no audit log (IP automático + meta.email). Sem
 * infra nova: o próprio Postgres é o store. Protege brute-force de credenciais
 * de profissionais de saúde sem travar um escritório inteiro atrás do mesmo NAT
 * (o par email+IP isola por conta e por origem).
 */

export const LOGIN_MAX_TENTATIVAS = 5;
export const LOGIN_JANELA_MIN = 15;

/** Pura: bloqueia quando as falhas na janela atingem o limite. */
export function loginBloqueado(tentativasNaJanela: number): boolean {
  return tentativasNaJanela >= LOGIN_MAX_TENTATIVAS;
}

/** IP do request — mesma extração do audit.ts (x-forwarded-for / x-real-ip). */
async function ipDoRequest(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
}

/**
 * Conta tentativas de login FALHAS recentes contra (email[, IP]) na janela.
 * Quando não há IP no request, conta só por email (fail-safe mais restritivo).
 */
export async function tentativasFalhasRecentes(email: string, agora: Date): Promise<number> {
  const ip = await ipDoRequest();
  const desde = new Date(agora.getTime() - LOGIN_JANELA_MIN * 60_000);
  return db.auditLog.count({
    where: {
      action: "signin_failed",
      createdAt: { gte: desde },
      meta: { path: ["email"], equals: email },
      ...(ip ? { ipAddress: ip } : {}),
    },
  });
}

/**
 * Gate de login: true se (email, IP) já estourou o limite na janela. Use ANTES
 * do bcrypt.compare / signIn nas server actions de login.
 */
export async function loginRateLimited(email: string, agora: Date): Promise<boolean> {
  return loginBloqueado(await tentativasFalhasRecentes(email, agora));
}
