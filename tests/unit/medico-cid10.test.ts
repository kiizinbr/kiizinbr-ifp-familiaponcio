import { describe, expect, it } from "vitest";
import {
  buildCid10Filter,
  canonicalizarDescricoes,
  CID_CODIGO_RE,
  DiagnosticosSchema,
  normalizarDiagnosticos,
  pareceCodigoCid,
  type DiagnosticosInput,
} from "@/lib/medico/cid10";

// Funções puras da frente CID-10 (molde: cidadao-search.test.ts — sem DB).

describe("pareceCodigoCid", () => {
  it("letra+dígito é código-like (case-insensitive, com trim)", () => {
    expect(pareceCodigoCid("J06")).toBe(true);
    expect(pareceCodigoCid("j06.9")).toBe(true);
    expect(pareceCodigoCid("  A0")).toBe(true);
  });

  it("texto, dígito inicial ou vazio não é código-like", () => {
    expect(pareceCodigoCid("infecção")).toBe(false);
    expect(pareceCodigoCid("9J")).toBe(false);
    expect(pareceCodigoCid("")).toBe(false);
  });
});

describe("buildCid10Filter", () => {
  it("termo código-like busca por prefixo de código (uppercased) E descrição insensitive", () => {
    expect(buildCid10Filter("j06")).toEqual({
      OR: [
        { codigo: { startsWith: "J06" } },
        { descricao: { contains: "j06", mode: "insensitive" } },
      ],
    });
  });

  it("termo textual busca só na descrição (insensitive)", () => {
    expect(buildCid10Filter("Infecção")).toEqual({
      descricao: { contains: "Infecção", mode: "insensitive" },
    });
  });

  it("aplica trim antes de montar o filtro", () => {
    expect(buildCid10Filter("  J06.9  ")).toEqual({
      OR: [
        { codigo: { startsWith: "J06.9" } },
        { descricao: { contains: "J06.9", mode: "insensitive" } },
      ],
    });
  });
});

describe("CID_CODIGO_RE", () => {
  it("aceita categoria e subcategoria; rejeita U e formatos quebrados", () => {
    expect(CID_CODIGO_RE.test("J06")).toBe(true);
    expect(CID_CODIGO_RE.test("J06.9")).toBe(true);
    expect(CID_CODIGO_RE.test("V97.10")).toBe(true);
    expect(CID_CODIGO_RE.test("U04")).toBe(false);
    expect(CID_CODIGO_RE.test("J6")).toBe(false);
    expect(CID_CODIGO_RE.test("J06.")).toBe(false);
    expect(CID_CODIGO_RE.test("gripe")).toBe(false);
  });
});

describe("DiagnosticosSchema", () => {
  const valido = { codigoCid: "J06.9", descricao: "IVAS", principal: true };

  it("aceita lista válida (inclusive codigoCid null)", () => {
    const r = DiagnosticosSchema.safeParse([
      valido,
      { ...valido, codigoCid: null, principal: false },
    ]);
    expect(r.success).toBe(true);
  });

  it("rejeita JSON que não é array (undefined / objeto / string)", () => {
    expect(DiagnosticosSchema.safeParse(undefined).success).toBe(false);
    expect(DiagnosticosSchema.safeParse({}).success).toBe(false);
    expect(DiagnosticosSchema.safeParse("J06.9").success).toBe(false);
  });

  it("rejeita mais de 10 itens", () => {
    const lista = Array.from({ length: 11 }, (_, i) => ({
      ...valido,
      codigoCid: null,
      descricao: `dx ${i}`,
      principal: i === 0,
    }));
    expect(DiagnosticosSchema.safeParse(lista).success).toBe(false);
  });

  it("rejeita descrição vazia (após trim) e descrição com 501 chars", () => {
    expect(DiagnosticosSchema.safeParse([{ ...valido, descricao: "   " }]).success).toBe(false);
    expect(DiagnosticosSchema.safeParse([{ ...valido, descricao: "x".repeat(501) }]).success).toBe(
      false,
    );
    expect(DiagnosticosSchema.safeParse([{ ...valido, descricao: "x".repeat(500) }]).success).toBe(
      true,
    );
  });
});

describe("normalizarDiagnosticos", () => {
  it("dedupe por código (mantém a primeira ocorrência)", () => {
    const r = normalizarDiagnosticos([
      { codigoCid: "J06.9", descricao: "IVAS", principal: true },
      { codigoCid: "J06.9", descricao: "duplicado", principal: false },
      { codigoCid: "E11.9", descricao: "DM2", principal: false },
    ]);
    expect(r).toHaveLength(2);
    expect(r[0]?.descricao).toBe("IVAS");
  });

  it("dedupe por descrição case-insensitive quando sem código", () => {
    const r = normalizarDiagnosticos([
      { codigoCid: null, descricao: "Cefaleia tensional", principal: false },
      { codigoCid: null, descricao: "CEFALEIA TENSIONAL", principal: false },
    ]);
    expect(r).toHaveLength(1);
  });

  it("0 marcados como principal → o primeiro vira principal", () => {
    const r = normalizarDiagnosticos([
      { codigoCid: "J06.9", descricao: "IVAS", principal: false },
      { codigoCid: "E11.9", descricao: "DM2", principal: false },
    ]);
    expect(r.map((d) => d.principal)).toEqual([true, false]);
  });

  it("2 marcados como principal → o primeiro marcado vence", () => {
    const r = normalizarDiagnosticos([
      { codigoCid: "J06.9", descricao: "IVAS", principal: false },
      { codigoCid: "E11.9", descricao: "DM2", principal: true },
      { codigoCid: "I10", descricao: "HAS", principal: true },
    ]);
    expect(r.map((d) => d.principal)).toEqual([false, true, false]);
  });

  it("código que falha na regex vira null e mantém a descrição", () => {
    const r = normalizarDiagnosticos([
      { codigoCid: "U04", descricao: "SARS", principal: true },
      { codigoCid: "##", descricao: "lixo de código", principal: false },
    ]);
    expect(r[0]).toEqual({ codigoCid: null, descricao: "SARS", principal: true });
    expect(r[1]?.codigoCid).toBeNull();
  });

  it("código minúsculo é normalizado pra maiúsculo antes da regex", () => {
    const r = normalizarDiagnosticos([{ codigoCid: "j06.9", descricao: "IVAS", principal: true }]);
    expect(r[0]?.codigoCid).toBe("J06.9");
  });

  it("lista vazia → lista vazia (semântica de limpar diagnósticos)", () => {
    expect(normalizarDiagnosticos([] as DiagnosticosInput)).toEqual([]);
  });
});

describe("canonicalizarDescricoes", () => {
  const oficiais = new Map([["J06.9", "Infecção aguda das vias aéreas superiores NE"]]);

  it("código presente na map → descrição sobrescrita pela oficial", () => {
    const r = canonicalizarDescricoes(
      [{ codigoCid: "J06.9", descricao: "texto adulterado", principal: true }],
      oficiais,
      true,
    );
    expect(r[0]?.descricao).toBe("Infecção aguda das vias aéreas superiores NE");
  });

  it("código forjado numa tabela CONSULTADA → rebaixa a texto livre (codigoCid null), mantém descrição", () => {
    const r = canonicalizarDescricoes(
      [{ codigoCid: "A99.8", descricao: "diagnóstico inventado", principal: true }],
      oficiais,
      true,
    );
    expect(r[0]).toEqual({ codigoCid: null, descricao: "diagnóstico inventado", principal: true });
  });

  it("código fora da map com tabela INDISPONÍVEL → mantém o código enviado (nunca bloqueia)", () => {
    const r = canonicalizarDescricoes(
      [{ codigoCid: "Z99.9", descricao: "descrição do médico", principal: true }],
      oficiais,
      false,
    );
    expect(r[0]).toEqual({ codigoCid: "Z99.9", descricao: "descrição do médico", principal: true });
  });

  it("sem código → intocado (tabela consultada ou não)", () => {
    const item = { codigoCid: null, descricao: "texto livre", principal: true };
    expect(canonicalizarDescricoes([item], oficiais, true)[0]).toEqual(item);
    expect(canonicalizarDescricoes([item], oficiais, false)[0]).toEqual(item);
  });
});
