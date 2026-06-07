import { describe, it, expect } from "vitest";
import { parseDataNascimento } from "../../src/lib/migracao-amplimed/datas";

describe("parseDataNascimento", () => {
  it("aceita ISO YYYY-MM-DD", () => {
    const r = parseDataNascimento("1990-05-21");
    expect(r.data?.toISOString().slice(0, 10)).toBe("1990-05-21");
    expect(r.problema).toBeNull();
  });
  it("aceita BR DD/MM/YYYY", () => {
    const r = parseDataNascimento("21/05/1990");
    expect(r.data?.toISOString().slice(0, 10)).toBe("1990-05-21");
  });
  it("rejeita data impossível", () => {
    const r = parseDataNascimento("32/13/1990");
    expect(r.data).toBeNull();
    expect(r.problema).toMatch(/data/i);
  });
  it("rejeita vazio/null", () => {
    expect(parseDataNascimento(null).data).toBeNull();
    expect(parseDataNascimento("").data).toBeNull();
  });
});
