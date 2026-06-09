import { describe, expect, it } from "vitest";
import {
  gerarSlots,
  criarMaquinaEstados,
  reservarCAS,
  type JanelaDisponibilidade,
} from "@/lib/agenda/core";

const baseDate = new Date("2026-06-01T00:00:00Z"); // segunda-feira
const janela: JanelaDisponibilidade = {
  diasSemana: [2, 4], // terça, quinta
  faixaInicio: "14:00",
  faixaFim: "16:00",
  duracaoSlotMin: 30,
  validoDe: baseDate,
  validoAte: new Date("2026-06-15T00:00:00Z"),
};

describe("core.gerarSlots", () => {
  it("gera slots só nos dias da semana definidos", () => {
    const datas = [
      ...new Set(gerarSlots(janela).map((s) => s.dataHoraInicio.toISOString().slice(0, 10))),
    ];
    expect(datas).toContain("2026-06-02");
    expect(datas).toContain("2026-06-04");
    expect(datas).not.toContain("2026-06-01");
    expect(datas).not.toContain("2026-06-03");
  });

  it("respeita faixa horária e duração", () => {
    const terca = gerarSlots(janela).filter((s) =>
      s.dataHoraInicio.toISOString().startsWith("2026-06-02"),
    );
    expect(terca).toHaveLength(4);
    expect(terca[0]!.dataHoraInicio.toISOString().slice(11, 16)).toBe("14:00");
    expect(terca[3]!.dataHoraInicio.toISOString().slice(11, 16)).toBe("15:30");
  });

  it("não corta slot pela metade quando a duração não cabe", () => {
    const t = gerarSlots({ ...janela, diasSemana: [2], faixaFim: "14:45" }).filter((s) =>
      s.dataHoraInicio.toISOString().startsWith("2026-06-02"),
    );
    expect(t).toHaveLength(1);
    expect(t[0]!.dataHoraInicio.toISOString().slice(11, 16)).toBe("14:00");
  });

  it("retorna SlotBase puro (só dataHoraInicio + duracaoMin) — sem recurso", () => {
    const s = gerarSlots(janela)[0]!;
    expect(Object.keys(s).sort()).toEqual(["dataHoraInicio", "duracaoMin"]);
    expect(s.duracaoMin).toBe(30);
  });

  it("validoAte nulo respeita limiteSuperior", () => {
    const limite = new Date("2026-06-10T00:00:00Z");
    const slots = gerarSlots({ ...janela, validoAte: null }, { limiteSuperior: limite });
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((s) => s.dataHoraInicio.getTime() < limite.getTime())).toBe(true);
  });

  it("lança quando validoAte é null e não há limiteSuperior", () => {
    expect(() => gerarSlots({ ...janela, validoAte: null })).toThrow(/limiteSuperior/);
  });
});

describe("core.criarMaquinaEstados", () => {
  const m = criarMaquinaEstados<"a" | "b" | "c">({
    a: new Set(["b", "c"]),
    b: new Set(["c"]),
    c: new Set([]),
  });
  it("pode() respeita as transições", () => {
    expect(m.pode("a", "b")).toBe(true);
    expect(m.pode("a", "c")).toBe(true);
    expect(m.pode("b", "a")).toBe(false);
    expect(m.pode("c", "a")).toBe(false);
  });
  it("alvos() devolve o conjunto de destinos", () => {
    expect([...m.alvos("a")].sort()).toEqual(["b", "c"]);
    expect(m.alvos("c").size).toBe(0);
  });
});

describe("core.reservarCAS", () => {
  it("retorna true quando o updateMany afeta exatamente 1 linha", async () => {
    expect(await reservarCAS(async () => ({ count: 1 }))).toBe(true);
  });
  it("retorna false quando 0 linhas (alguém já pegou o slot)", async () => {
    expect(await reservarCAS(async () => ({ count: 0 }))).toBe(false);
  });
});
