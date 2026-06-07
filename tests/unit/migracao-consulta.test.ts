import { describe, it, expect } from "vitest";
import { mapConsultaParaNota, horaSinteticaSlot } from "../../src/lib/migracao-amplimed/consulta";
import type { ConsultaRow } from "../../src/lib/migracao-amplimed/tipos";

const row: ConsultaRow = {
  codcon: 7,
  codp: 1,
  codu: 2,
  dtconsulta: "2024-08-01",
  queixa: "cefaleia",
  anteceden: "HAS",
  descfis: "BEG",
  conduta: "dipirona",
  meds: null,
  cid10: "G43 Enxaqueca",
  peso: 70,
  altura: 170,
  pas: 120,
  pad: 80,
  freqcar: 72,
  freqres: 16,
  tempe: 36.5,
};

describe("mapConsultaParaNota", () => {
  it("mapeia vitais e compõe texto + diagnóstico", () => {
    const n = mapConsultaParaNota(row);
    expect(n.paSistolica).toBe(120);
    expect(n.fcBpm).toBe(72);
    expect(n.pesoKg).toBe(70);
    expect(n.alturaCm).toBe(170);
    expect(n.diagnosticos[0]?.codigoCid).toBe("G43");
    expect(n.texto).toMatch(/cefaleia/);
    expect(n.texto).toMatch(/conduta/i);
  });

  // Dados sujos da Amplimed: peso digitado em gramas (7000) estoura Decimal(5,2).
  // Sanitiza p/ não estourar o banco nem inventar valor → null.
  it("descarta vitais fora de faixa (anti-overflow / lixo) virando null", () => {
    const n = mapConsultaParaNota({ ...row, peso: 7000, tempe: 9999, pas: 0, altura: 0 });
    expect(n.pesoKg).toBeNull();
    expect(n.tempC).toBeNull();
    expect(n.paSistolica).toBeNull();
    expect(n.alturaCm).toBeNull();
  });
});

describe("horaSinteticaSlot", () => {
  it("ordem 0 = 08:00; cada ordem soma a duração; não colide", () => {
    const dia = new Date(Date.UTC(2024, 7, 1));
    const a = horaSinteticaSlot(dia, 0, 30);
    const b = horaSinteticaSlot(dia, 1, 30);
    expect(a.getUTCHours()).toBe(8);
    expect(a.getUTCMinutes()).toBe(0);
    expect(b.getUTCMinutes()).toBe(30);
    expect(a.getTime()).not.toBe(b.getTime());
  });
});
