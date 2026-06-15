import { describe, expect, it } from "vitest";
import {
  agruparSlotsPorDiaLocal,
  chaveDiaLocal,
  MAX_SLOTS_SEMANA,
  type SlotComInicio,
} from "@/lib/medico/agenda-grid";

function slot(iso: string): SlotComInicio {
  return { dataHoraInicio: new Date(iso) };
}

describe("chaveDiaLocal", () => {
  it("usa campos LOCAIS (ano-mes-dia), espelhando o filtro anterior da grade", () => {
    const d = new Date(2026, 5, 2, 14, 30); // 02 jun 2026, mês 0-based = 5
    expect(chaveDiaLocal(d)).toBe("2026-5-2");
  });

  it("dois instantes no mesmo dia local caem na mesma chave", () => {
    const a = new Date(2026, 5, 2, 7, 0);
    const b = new Date(2026, 5, 2, 19, 45);
    expect(chaveDiaLocal(a)).toBe(chaveDiaLocal(b));
  });

  it("dias diferentes têm chaves diferentes", () => {
    expect(chaveDiaLocal(new Date(2026, 5, 2, 9, 0))).not.toBe(
      chaveDiaLocal(new Date(2026, 5, 3, 9, 0)),
    );
  });
});

describe("agruparSlotsPorDiaLocal", () => {
  it("agrupa slots de 2 dias nos buckets corretos", () => {
    const s1 = slot("2026-06-02T14:00:00");
    const s2 = slot("2026-06-02T14:30:00");
    const s3 = slot("2026-06-04T09:00:00");
    const mapa = agruparSlotsPorDiaLocal([s1, s2, s3]);

    expect(mapa.size).toBe(2);
    expect(mapa.get(chaveDiaLocal(new Date("2026-06-02T00:00:00")))).toEqual([s1, s2]);
    expect(mapa.get(chaveDiaLocal(new Date("2026-06-04T00:00:00")))).toEqual([s3]);
  });

  it("preserva a ordem de entrada dentro de cada bucket", () => {
    const cedo = slot("2026-06-02T08:00:00");
    const tarde = slot("2026-06-02T17:00:00");
    const mapa = agruparSlotsPorDiaLocal([cedo, tarde]);
    const bucket = mapa.get(chaveDiaLocal(new Date("2026-06-02T00:00:00")))!;
    expect(bucket[0]).toBe(cedo);
    expect(bucket[1]).toBe(tarde);
  });

  it("lista vazia gera mapa vazio (dia sem slot devolve [] via ?? na página)", () => {
    const mapa = agruparSlotsPorDiaLocal([]);
    expect(mapa.size).toBe(0);
    expect(mapa.get("qualquer") ?? []).toEqual([]);
  });

  it("bucketização cobre os mesmos slots que o filtro por dia faria (paridade)", () => {
    const todos = [
      slot("2026-06-02T14:00:00"),
      slot("2026-06-03T10:00:00"),
      slot("2026-06-02T15:00:00"),
      slot("2026-06-04T11:00:00"),
    ];
    const mapa = agruparSlotsPorDiaLocal(todos);
    const totalBuckets = [...mapa.values()].reduce((acc, arr) => acc + arr.length, 0);
    expect(totalBuckets).toBe(todos.length);
  });
});

describe("MAX_SLOTS_SEMANA", () => {
  it("teto defensivo é um inteiro positivo plausível para uma semana", () => {
    expect(Number.isInteger(MAX_SLOTS_SEMANA)).toBe(true);
    expect(MAX_SLOTS_SEMANA).toBeGreaterThan(0);
  });
});
