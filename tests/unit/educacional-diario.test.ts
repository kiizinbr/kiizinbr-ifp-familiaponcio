import { describe, expect, it } from "vitest";
import { podeRegistrar, podeFechar, diarioVisivelParaFamilia } from "@/lib/educacional/diario";

/**
 * Lógica PURA do diário/selo (sem DB). Espelha `autorizado.ts`:
 * decisão isolada, testável por objeto literal. Slice 3.
 *
 * Invariantes do selo (fonte `main` rotina.service.ts/familia.service.ts):
 *  - FECHADO = imutável (nenhum registro novo) e visível à família;
 *  - ABERTO/inexistente = mutável, mas invisível à família;
 *  - fechar exige ABERTO + ≥1 registro.
 */

describe("podeRegistrar (imutabilidade do diário FECHADO)", () => {
  it("diário ABERTO → permite registrar", () => {
    expect(podeRegistrar("ABERTO").ok).toBe(true);
  });

  it("diário FECHADO → bloqueia (selo: imutável)", () => {
    const r = podeRegistrar("FECHADO");
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/fechad/i);
  });
});

describe("podeFechar (exige ABERTO + ≥1 registro)", () => {
  it("ABERTO com 1 registro → ok", () => {
    expect(podeFechar("ABERTO", 1).ok).toBe(true);
  });

  it("ABERTO com vários registros → ok", () => {
    expect(podeFechar("ABERTO", 3).ok).toBe(true);
  });

  it("ABERTO sem registro → bloqueia (não fecha diário vazio)", () => {
    const r = podeFechar("ABERTO", 0);
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/registro/i);
  });

  it("já FECHADO → bloqueia (idempotência: não refecha)", () => {
    const r = podeFechar("FECHADO", 3);
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/fechad/i);
  });
});

describe("diarioVisivelParaFamilia (selo de visibilidade)", () => {
  it("diário null (nenhum no dia) → invisível", () => {
    expect(diarioVisivelParaFamilia(null)).toBe(false);
  });

  it("diário ABERTO → invisível (família só vê o dia selado)", () => {
    expect(diarioVisivelParaFamilia({ status: "ABERTO" })).toBe(false);
  });

  it("diário FECHADO → visível", () => {
    expect(diarioVisivelParaFamilia({ status: "FECHADO" })).toBe(true);
  });
});
