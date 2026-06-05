import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Sempre dinâmico: o health precisa refletir o estado AGORA, nunca um cache.
export const dynamic = "force-dynamic";

/** Ping no banco (SELECT 1). A falha é o próprio sinal — vira status 503, não relança. */
async function bancoAcessivel(): Promise<boolean> {
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

/**
 * Healthcheck público (sem dados sensíveis): confirma que o app responde e que o
 * banco está acessível. 200 = saudável; 503 = banco fora. Consumido pelo healthcheck
 * do container (docker-compose.prod) e por um monitor externo de uptime.
 */
export async function GET() {
  const dbOk = await bancoAcessivel();

  return NextResponse.json(
    { status: dbOk ? "ok" : "degraded", db: dbOk ? "up" : "down", time: new Date().toISOString() },
    { status: dbOk ? 200 : 503 },
  );
}
