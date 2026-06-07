import { describe, it, expect } from "vitest";
import { parseCid10Texto } from "../../src/lib/migracao-amplimed/cid10";

describe("parseCid10Texto", () => {
  it("extrai múltiplos códigos, 1º é principal", () => {
    const r = parseCid10Texto("J06.9 - IVAS; I10 Hipertensão");
    expect(r).toEqual([
      { codigoCid: "J06.9", descricao: "IVAS", principal: true },
      { codigoCid: "I10", descricao: "Hipertensão", principal: false },
    ]);
  });
  it("texto livre sem código vira descrição sem codigoCid", () => {
    const r = parseCid10Texto("dor de cabeça");
    expect(r).toEqual([{ codigoCid: null, descricao: "dor de cabeça", principal: true }]);
  });
  it("vazio retorna []", () => {
    expect(parseCid10Texto("")).toEqual([]);
    expect(parseCid10Texto(null)).toEqual([]);
  });
});
