import { describe, expect, it } from "vitest";
import {
  calcularImc,
  formatVitalSeguro,
  podeTransicionarNota,
  validarSinaisVitais,
} from "@/lib/medico/prontuario";

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

  // F2 (higiene da ficha) — guard de plausibilidade reusando FAIXAS_PLAUSIVEIS.
  // Caso real: migração Amplimed gravou altura em METROS (intSeguro(1.68)=2) e
  // a timeline exibia IMC 233500. Guard display-only: a nota não é reescrita.
  it("caso real 233500: altura migrada em metros (93.4kg, 2cm) → null", () => {
    expect(calcularImc(93.4, 2)).toBeNull();
  });
  it("mesmo paciente na escala correta (93.4kg, 168cm) ≈ 33.1", () => {
    expect(calcularImc(93.4, 168)).toBeCloseTo(33.1, 1);
  });
  it("bordas de altura: 30 e 250 cm válidas; 29 e 251 → null", () => {
    expect(calcularImc(70, 30)).not.toBeNull();
    expect(calcularImc(70, 250)).not.toBeNull();
    expect(calcularImc(70, 29)).toBeNull();
    expect(calcularImc(70, 251)).toBeNull();
  });
  it("bordas de peso: 0.5 e 400 kg válidas; 0.4 e 401 → null", () => {
    expect(calcularImc(0.5, 50)).not.toBeNull();
    expect(calcularImc(400, 175)).not.toBeNull();
    expect(calcularImc(0.4, 50)).toBeNull();
    expect(calcularImc(401, 175)).toBeNull();
  });
  it("inputs null seguem retornando null com o guard", () => {
    expect(calcularImc(null, null)).toBeNull();
    expect(calcularImc(undefined, 170)).toBeNull();
    expect(calcularImc(80, undefined)).toBeNull();
  });
});

describe("formatVitalSeguro", () => {
  it("altura migrada em metros (2cm) → —", () => {
    expect(formatVitalSeguro("alturaCm", 2)).toBe("—");
  });
  it("altura plausível formata com unidade", () => {
    expect(formatVitalSeguro("alturaCm", 168, " cm")).toBe("168 cm");
  });
  it("peso em gramas (7000) fora de faixa → —", () => {
    expect(formatVitalSeguro("pesoKg", 7000, " kg")).toBe("—");
  });
  it("null/undefined → —", () => {
    expect(formatVitalSeguro("fcBpm", null)).toBe("—");
    expect(formatVitalSeguro("spo2", undefined)).toBe("—");
  });
  it("bordas inclusivas (alturaCm 30 e 250 válidas; 29/251 → —)", () => {
    expect(formatVitalSeguro("alturaCm", 30)).toBe("30");
    expect(formatVitalSeguro("alturaCm", 250)).toBe("250");
    expect(formatVitalSeguro("alturaCm", 29)).toBe("—");
    expect(formatVitalSeguro("alturaCm", 251)).toBe("—");
  });
  it("sem unidade não concatena sufixo", () => {
    expect(formatVitalSeguro("paSistolica", 120)).toBe("120");
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
