import { describe, expect, it } from "vitest";
import { calcularImc, podeTransicionarNota, validarSinaisVitais } from "@/lib/medico/prontuario";

// T2 — núcleo PURO do prontuário (sem DB). Espelha o padrão de medico-rbac.test.ts:
// import direto, asserção pura. O ralph-loop implementa prontuario.ts até estes passarem.

describe("calcularImc", () => {
  it("calcula IMC normal (70kg, 175cm ~ 22.9)", () => {
    expect(calcularImc(70, 175)).toBeCloseTo(22.9, 1);
  });
  it("retorna null se peso ausente", () => {
    expect(calcularImc(null, 175)).toBeNull();
  });
  it("retorna null se altura ausente", () => {
    expect(calcularImc(70, null)).toBeNull();
  });
  it("retorna null se altura zero (sem divisão por zero)", () => {
    expect(calcularImc(70, 0)).toBeNull();
  });
});

describe("validarSinaisVitais", () => {
  it("sem nenhum sinal → nenhum warning", () => {
    expect(validarSinaisVitais({})).toEqual([]);
  });
  it("valores plausíveis → nenhum warning", () => {
    expect(validarSinaisVitais({ paSistolica: 120, fcBpm: 72 })).toEqual([]);
  });
  it("FC absurda (320) → 1 warning no campo fcBpm", () => {
    const w = validarSinaisVitais({ fcBpm: 320 });
    expect(w).toHaveLength(1);
    expect(w[0]?.campo).toBe("fcBpm");
  });
  it("vários fora de range → vários warnings, nunca lança", () => {
    const w = validarSinaisVitais({ spo2: 30, tempC: 50 });
    expect(w).toHaveLength(2);
  });
});

describe("podeTransicionarNota", () => {
  it("rascunho → assinada é válido", () => {
    expect(podeTransicionarNota("rascunho", "assinada")).toBe(true);
  });
  it("assinada → rascunho é inválido (imutável §0.4)", () => {
    expect(podeTransicionarNota("assinada", "rascunho")).toBe(false);
  });
  it("assinada → assinada é inválido (não re-assina)", () => {
    expect(podeTransicionarNota("assinada", "assinada")).toBe(false);
  });
});
