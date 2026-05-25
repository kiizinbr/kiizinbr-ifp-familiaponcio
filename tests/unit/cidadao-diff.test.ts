import { describe, expect, it } from "vitest";
import { changedFields } from "@/lib/cidadao-diff";

describe("changedFields", () => {
  it("retorna só os campos alterados", () => {
    const a = { nomeCompleto: "Ana", telefonePrincipal: "111", alergias: "nenhuma" };
    const b = { nomeCompleto: "Ana", telefonePrincipal: "222", alergias: "dipirona" };
    expect(changedFields(a, b).sort()).toEqual(["alergias", "telefonePrincipal"]);
  });

  it("lista vazia quando nada muda", () => {
    expect(changedFields({ x: "1" }, { x: "1" })).toEqual([]);
  });

  it("trata null/undefined/'' como equivalentes (não conta como mudança)", () => {
    expect(changedFields({ a: null, b: undefined }, { a: "", b: "" })).toEqual([]);
  });

  it("considera só as chaves presentes no novo payload", () => {
    expect(changedFields({ a: "1", extra: "x" }, { a: "2" })).toEqual(["a"]);
  });
});
