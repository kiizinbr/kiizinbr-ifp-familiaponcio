import { describe, expect, it } from "vitest";
import {
  MAX_RECEITA_ITENS,
  ReceitaItensSchema,
  normalizarReceitaItens,
  type ReceitaItensInput,
} from "@/lib/medico/receita";

// Funções puras da receita multi-item (molde: medico-cid10.test.ts — sem DB).

const valido = { medicamento: "Amoxicilina 500mg", posologia: "1 comp 8/8h por 7 dias" };

describe("ReceitaItensSchema", () => {
  it("aceita 1 item mínimo (só medicamento + posologia)", () => {
    expect(ReceitaItensSchema.safeParse([valido]).success).toBe(true);
  });

  it("aceita item com quantidade/via", () => {
    const r = ReceitaItensSchema.safeParse([{ ...valido, quantidade: "1 caixa", via: "Oral" }]);
    expect(r.success).toBe(true);
  });

  it("rejeita lista vazia (receita sem item)", () => {
    expect(ReceitaItensSchema.safeParse([]).success).toBe(false);
  });

  it("rejeita item sem medicamento (após trim)", () => {
    expect(ReceitaItensSchema.safeParse([{ ...valido, medicamento: "   " }]).success).toBe(false);
  });

  it("rejeita item sem posologia (após trim)", () => {
    expect(ReceitaItensSchema.safeParse([{ ...valido, posologia: "" }]).success).toBe(false);
  });

  it("rejeita JSON que não é array (undefined / objeto / string)", () => {
    expect(ReceitaItensSchema.safeParse(undefined).success).toBe(false);
    expect(ReceitaItensSchema.safeParse({}).success).toBe(false);
    expect(ReceitaItensSchema.safeParse("Amoxicilina").success).toBe(false);
  });

  it(`aceita exatamente ${MAX_RECEITA_ITENS} itens e rejeita ${MAX_RECEITA_ITENS + 1}`, () => {
    const lista = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ ...valido, medicamento: `Medic ${i}` }));
    expect(ReceitaItensSchema.safeParse(lista(MAX_RECEITA_ITENS)).success).toBe(true);
    expect(ReceitaItensSchema.safeParse(lista(MAX_RECEITA_ITENS + 1)).success).toBe(false);
  });

  it("rejeita medicamento com 301 chars e posologia com 501 chars", () => {
    expect(
      ReceitaItensSchema.safeParse([{ ...valido, medicamento: "x".repeat(301) }]).success,
    ).toBe(false);
    expect(ReceitaItensSchema.safeParse([{ ...valido, posologia: "x".repeat(501) }]).success).toBe(
      false,
    );
  });
});

describe("normalizarReceitaItens", () => {
  it("quantidade/via vazios ou ausentes viram null", () => {
    const input = ReceitaItensSchema.parse([
      { medicamento: "Dipirona", posologia: "1 comp", quantidade: "", via: "   " },
      { medicamento: "Paracetamol", posologia: "1 comp" },
    ]);
    const r = normalizarReceitaItens(input);
    expect(r[0]).toEqual({
      medicamento: "Dipirona",
      posologia: "1 comp",
      quantidade: null,
      via: null,
    });
    expect(r[1]).toEqual({
      medicamento: "Paracetamol",
      posologia: "1 comp",
      quantidade: null,
      via: null,
    });
  });

  it("aplica trim (já feito pelo zod) em medicamento/posologia/quantidade/via", () => {
    const input = ReceitaItensSchema.parse([
      {
        medicamento: "  Ibuprofeno  ",
        posologia: "  1 comp 12/12h  ",
        quantidade: "  2 caixas  ",
        via: "  Oral  ",
      },
    ]);
    const r = normalizarReceitaItens(input);
    expect(r[0]).toEqual({
      medicamento: "Ibuprofeno",
      posologia: "1 comp 12/12h",
      quantidade: "2 caixas",
      via: "Oral",
    });
  });

  it("preserva N itens na ordem (1..N)", () => {
    const input: ReceitaItensInput = ReceitaItensSchema.parse([
      { medicamento: "A", posologia: "p1" },
      { medicamento: "B", posologia: "p2" },
      { medicamento: "C", posologia: "p3" },
    ]);
    const r = normalizarReceitaItens(input);
    expect(r.map((i) => i.medicamento)).toEqual(["A", "B", "C"]);
  });
});
