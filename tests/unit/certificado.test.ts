import { describe, it, expect } from "vitest";
import {
  avaliarElegibilidade,
  normalizarCodigo,
  FREQUENCIA_MINIMA_CERTIFICADO,
} from "@/lib/capacitacao/certificado";

/** n presenças + faltas faltas. */
function presencas(n: number, faltas = 0): { presente: boolean }[] {
  return [
    ...Array.from({ length: n }, () => ({ presente: true })),
    ...Array.from({ length: faltas }, () => ({ presente: false })),
  ];
}

describe("avaliarElegibilidade", () => {
  it("elegível quando concluído e frequência exatamente 80%", () => {
    const r = avaliarElegibilidade("concluido", presencas(8, 2));
    expect(r.elegivel).toBe(true);
    expect(r.percentual).toBe(80);
    expect(r.motivo).toBeNull();
  });

  it("inelegível quando frequência < 80% (cita o mínimo)", () => {
    const r = avaliarElegibilidade("concluido", presencas(7, 3));
    expect(r.elegivel).toBe(false);
    expect(r.percentual).toBe(70);
    expect(r.motivo).toContain(String(FREQUENCIA_MINIMA_CERTIFICADO));
  });

  it("inelegível quando a matrícula não está concluída, mesmo com 100%", () => {
    const r = avaliarElegibilidade("cursando", presencas(10));
    expect(r.elegivel).toBe(false);
    expect(r.motivo).toContain("concluída");
  });

  it("inelegível quando não há presença registrada", () => {
    const r = avaliarElegibilidade("concluido", []);
    expect(r.elegivel).toBe(false);
    expect(r.percentual).toBe(0);
    expect(r.motivo).toContain("presença");
  });
});

describe("normalizarCodigo", () => {
  it("trim + maiúsculas + remove espaços", () => {
    expect(normalizarCodigo("  ab cd 12 ")).toBe("ABCD12");
  });
});
