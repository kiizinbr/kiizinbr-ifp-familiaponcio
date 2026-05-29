import { describe, expect, it } from "vitest";
import { gerarSlots, type TemplateInput } from "@/lib/medico/agenda";

const baseDate = new Date("2026-06-01T00:00:00Z"); // segunda-feira

const tmplPadrao: TemplateInput = {
  profissionalId: "p1",
  especialidadeId: "e1",
  diasSemana: [2, 4], // terça, quinta
  faixaInicio: "14:00",
  faixaFim: "16:00",
  duracaoSlotMin: 30,
  validoDe: baseDate,
  validoAte: new Date("2026-06-15T00:00:00Z"),
};

describe("gerarSlots", () => {
  it("gera slots só nos dias da semana definidos", () => {
    const slots = gerarSlots(tmplPadrao);
    // 2026-06-01 é segunda (dow=1) — não gera. 06-02 terça, 06-04 quinta.
    const datasGeradas = [
      ...new Set(slots.map((s) => s.dataHoraInicio.toISOString().slice(0, 10))),
    ];
    expect(datasGeradas).toContain("2026-06-02");
    expect(datasGeradas).toContain("2026-06-04");
    expect(datasGeradas).not.toContain("2026-06-01");
    expect(datasGeradas).not.toContain("2026-06-03");
  });

  it("respeita faixa horária e duração", () => {
    const slots = gerarSlots(tmplPadrao).filter((s) =>
      s.dataHoraInicio.toISOString().startsWith("2026-06-02"),
    );
    // 14:00–16:00 com 30min = 4 slots: 14:00, 14:30, 15:00, 15:30
    expect(slots).toHaveLength(4);
    expect(slots[0]!.dataHoraInicio.toISOString().slice(11, 16)).toBe("14:00");
    expect(slots[3]!.dataHoraInicio.toISOString().slice(11, 16)).toBe("15:30");
  });

  it("não passa do validoAte", () => {
    const slots = gerarSlots(tmplPadrao);
    for (const s of slots) {
      expect(s.dataHoraInicio.getTime()).toBeLessThan(tmplPadrao.validoAte!.getTime());
    }
  });

  it("propaga profissionalId e especialidadeId em cada slot", () => {
    const slots = gerarSlots(tmplPadrao);
    expect(slots.every((s) => s.profissionalId === "p1")).toBe(true);
    expect(slots.every((s) => s.especialidadeId === "e1")).toBe(true);
    expect(slots.every((s) => s.duracaoMin === 30)).toBe(true);
  });

  it("não corta slot pela metade quando duração não cabe na faixa", () => {
    const tmpl: TemplateInput = {
      ...tmplPadrao,
      diasSemana: [2],
      faixaInicio: "14:00",
      faixaFim: "14:45",
      duracaoSlotMin: 30,
    };
    const slots = gerarSlots(tmpl);
    // 14:00 (até 14:30) cabe; 14:30 (até 15:00) passa de 14:45 → 1 slot.
    const terca = slots.filter((s) => s.dataHoraInicio.toISOString().startsWith("2026-06-02"));
    expect(terca).toHaveLength(1);
    expect(terca[0]!.dataHoraInicio.toISOString().slice(11, 16)).toBe("14:00");
  });

  it("validoAte nulo respeita limiteSuperior do parâmetro", () => {
    const tmpl: TemplateInput = { ...tmplPadrao, validoAte: null };
    const limite = new Date("2026-06-10T00:00:00Z");
    const slots = gerarSlots(tmpl, { limiteSuperior: limite });
    expect(slots.every((s) => s.dataHoraInicio.getTime() < limite.getTime())).toBe(true);
    expect(slots.length).toBeGreaterThan(0);
  });
});
