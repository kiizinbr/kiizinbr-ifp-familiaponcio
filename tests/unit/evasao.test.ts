import { describe, it, expect } from "vitest";
import { avaliarRiscoEvasao } from "@/lib/capacitacao/evasao";

const p = { presente: true };
const f = { presente: false };

describe("avaliarRiscoEvasao", () => {
  it("não em risco com frequência alta e sem faltas seguidas", () => {
    expect(avaliarRiscoEvasao([p, p, p, p]).emRisco).toBe(false);
  });

  it("em risco por frequência abaixo do limite", () => {
    const r = avaliarRiscoEvasao([f, f, f, p, p]); // 40%, sem faltas seguidas no fim
    expect(r.emRisco).toBe(true);
    expect(r.percentual).toBe(40);
    expect(r.motivos.some((m) => m.includes("Frequência"))).toBe(true);
  });

  it("em risco por faltas seguidas mesmo com frequência ok", () => {
    const r = avaliarRiscoEvasao([p, p, p, p, p, p, p, p, p, p, f, f, f]); // ~77%, 3 faltas no fim
    expect(r.emRisco).toBe(true);
    expect(r.faltasConsecutivas).toBe(3);
    expect(r.motivos.some((m) => m.includes("seguidas"))).toBe(true);
  });

  it("2 faltas seguidas + frequência ok → não em risco", () => {
    expect(avaliarRiscoEvasao([p, p, p, p, p, p, p, p, f, f]).emRisco).toBe(false); // 80%, 2 seguidas
  });

  it("sem aulas registradas → não em risco", () => {
    expect(avaliarRiscoEvasao([]).emRisco).toBe(false);
  });
});
