import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// logEvent usa headers() do Next (só existe em request scope). Mockamos igual ao
// teste de ouro do Slice 2, para o audit não engolir silenciosamente o evento.
vi.mock("next/headers", () => ({
  headers: () =>
    Promise.resolve({ get: () => null } as unknown as Awaited<
      ReturnType<typeof import("next/headers").headers>
    >),
}));

import { db } from "@/lib/db";
import {
  registrarRotina,
  fecharDiario,
  DiarioFechadoError,
  DiarioJaFechadoError,
} from "@/lib/educacional/rotina";

/**
 * SELO DB-real — usa o seed do Slice 1 (criança Ana = seed-edu-crianca + educadora
 * Tia Beatriz). registrarRotina/fecharDiario operam no diário de HOJE, então o
 * teste garante um diário FECHADO de hoje (upsert idempotente) e prova:
 *   1. registrar rotina num diário FECHADO → bloqueado (DiarioFechadoError);
 *   2. fechar de novo um diário já FECHADO → idempotente (DiarioJaFechadoError).
 *
 * Cleanup: zera os registros e reabre o diário de hoje no afterAll, para não
 * sujar o estado do seed (o diário FECHADO canônico do seed é o de ONTEM).
 *
 * Requer o seed aplicado (`pnpm db:seed`). Sem seed, pula.
 */

const CRIANCA_ID = "seed-edu-crianca";

function hojeData(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

describe("diário FECHADO DB-real — selo de imutabilidade", () => {
  let temSeed = false;
  let profissionalId = "";
  let userId = "";
  let diarioHojeId = "";

  beforeAll(async () => {
    const educadora = await db.profissional.findFirst({
      where: { user: { email: "tia.beatriz@familiaponcio.org.br" } },
      include: { user: true },
    });
    const crianca = await db.familiar.findUnique({ where: { id: CRIANCA_ID } });
    if (!educadora || !crianca) return;

    temSeed = true;
    profissionalId = educadora.id;
    userId = educadora.userId;

    // Garante um diário de HOJE FECHADO com ≥1 registro (idempotente).
    const data = hojeData();
    const diario = await db.diarioDia.upsert({
      where: { criancaId_data: { criancaId: CRIANCA_ID, data } },
      update: { status: "FECHADO", fechadoEm: new Date(), profissionalId },
      create: {
        criancaId: CRIANCA_ID,
        data,
        status: "FECHADO",
        fechadoEm: new Date(),
        profissionalId,
      },
    });
    diarioHojeId = diario.id;
    await db.registroRotina.upsert({
      where: { id: "test-edu-reg-selo" },
      update: {},
      create: {
        id: "test-edu-reg-selo",
        diarioId: diario.id,
        tipo: "ATIVIDADE",
        descricao: "registro de fixture do teste de selo",
        profissionalId,
      },
    });
  });

  afterAll(async () => {
    if (!temSeed || !diarioHojeId) return;
    // Limpa o diário de HOJE criado pelo teste (não faz parte do seed canônico).
    await db.registroRotina.deleteMany({ where: { diarioId: diarioHojeId } });
    await db.diarioDia.deleteMany({ where: { id: diarioHojeId } });
  });

  it("registrar rotina no diário FECHADO de hoje → bloqueado (DiarioFechadoError)", async () => {
    if (!temSeed) {
      console.warn("[skip] seed educacional ausente — rode `pnpm db:seed`");
      return;
    }

    const antes = await db.registroRotina.count({ where: { diarioId: diarioHojeId } });

    await expect(
      registrarRotina({
        criancaId: CRIANCA_ID,
        profissionalId,
        userId,
        tipo: "ATIVIDADE",
        descricao: "tentativa indevida após o selo",
      }),
    ).rejects.toBeInstanceOf(DiarioFechadoError);

    // Nenhum registro novo entrou no diário selado.
    const depois = await db.registroRotina.count({ where: { diarioId: diarioHojeId } });
    expect(depois).toBe(antes);
  });

  it("fechar de novo um diário já FECHADO → idempotente (DiarioJaFechadoError)", async () => {
    if (!temSeed) {
      console.warn("[skip] seed educacional ausente — rode `pnpm db:seed`");
      return;
    }

    await expect(
      fecharDiario({ diarioId: diarioHojeId, profissionalId, userId }),
    ).rejects.toBeInstanceOf(DiarioJaFechadoError);
  });
});
