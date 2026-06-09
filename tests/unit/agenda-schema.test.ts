import { describe, it, expect } from "vitest";
import {
  reservarConsultaSchema,
  criarTemplateSchema,
  criarSlotAdHocSchema,
} from "@/lib/medico/agenda-schema";

/**
 * B4 — validação Zod nas server actions de FormData (antes só `String(...)`/`new Date(...)`
 * cru ia direto pro Prisma, gerando 500 opaco ou IDs vazios).
 */

describe("reservarConsultaSchema", () => {
  const ok = {
    slotId: "cslot1",
    cidadaoId: "ccid1",
    profissionalId: "cprof1",
    especialidadeId: "cesp1",
  };

  it("aceita os 4 IDs não-vazios", () => {
    expect(reservarConsultaSchema.safeParse(ok).success).toBe(true);
  });

  it("rejeita slotId vazio", () => {
    expect(reservarConsultaSchema.safeParse({ ...ok, slotId: "" }).success).toBe(false);
  });

  it("rejeita cidadaoId ausente", () => {
    const { cidadaoId: _omit, ...semCidadao } = ok;
    void _omit;
    expect(reservarConsultaSchema.safeParse(semCidadao).success).toBe(false);
  });
});

describe("criarTemplateSchema", () => {
  const ok = {
    diasSemana: [1, 3, 5],
    faixaInicio: "08:00",
    faixaFim: "12:00",
    duracaoSlotMin: 30,
    especialidadeId: "cesp1",
    validoDe: "2026-06-10",
    validoAte: "2026-09-10",
  };

  it("aceita um template válido", () => {
    expect(criarTemplateSchema.safeParse(ok).success).toBe(true);
  });

  it("aceita validoAte vazio (opcional)", () => {
    expect(criarTemplateSchema.safeParse({ ...ok, validoAte: "" }).success).toBe(true);
  });

  it("rejeita horário fora do formato HH:mm", () => {
    expect(criarTemplateSchema.safeParse({ ...ok, faixaInicio: "25:00" }).success).toBe(false);
    expect(criarTemplateSchema.safeParse({ ...ok, faixaFim: "8h" }).success).toBe(false);
  });

  it("rejeita faixa final <= inicial (refine)", () => {
    expect(
      criarTemplateSchema.safeParse({ ...ok, faixaInicio: "12:00", faixaFim: "08:00" }).success,
    ).toBe(false);
  });

  it("rejeita lista de dias vazia", () => {
    expect(criarTemplateSchema.safeParse({ ...ok, diasSemana: [] }).success).toBe(false);
  });

  it("rejeita dia da semana fora de 0..6", () => {
    expect(criarTemplateSchema.safeParse({ ...ok, diasSemana: [7] }).success).toBe(false);
  });

  it("rejeita duração fora da faixa", () => {
    expect(criarTemplateSchema.safeParse({ ...ok, duracaoSlotMin: 2 }).success).toBe(false);
    expect(criarTemplateSchema.safeParse({ ...ok, duracaoSlotMin: 999 }).success).toBe(false);
  });

  it("rejeita validoDe que não é YYYY-MM-DD", () => {
    expect(criarTemplateSchema.safeParse({ ...ok, validoDe: "10/06/2026" }).success).toBe(false);
    expect(criarTemplateSchema.safeParse({ ...ok, validoDe: "" }).success).toBe(false);
  });
});

describe("criarSlotAdHocSchema", () => {
  const ok = {
    cidadaoId: "ccid1",
    profissionalId: "cprof1",
    especialidadeId: "cesp1",
    dataHoraInicio: "2026-06-15T14:30",
    duracaoMin: "30",
  };

  it("aceita ad-hoc válido (coerce de data e duração)", () => {
    const r = criarSlotAdHocSchema.safeParse(ok);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.dataHoraInicio).toBeInstanceOf(Date);
      expect(r.data.duracaoMin).toBe(30);
    }
  });

  it("rejeita profissionalId vazio", () => {
    expect(criarSlotAdHocSchema.safeParse({ ...ok, profissionalId: "" }).success).toBe(false);
  });

  it("rejeita data inválida", () => {
    expect(criarSlotAdHocSchema.safeParse({ ...ok, dataHoraInicio: "nao-e-data" }).success).toBe(
      false,
    );
  });

  it("rejeita duração fora da faixa", () => {
    expect(criarSlotAdHocSchema.safeParse({ ...ok, duracaoMin: "0" }).success).toBe(false);
    expect(criarSlotAdHocSchema.safeParse({ ...ok, duracaoMin: "999" }).success).toBe(false);
  });
});
