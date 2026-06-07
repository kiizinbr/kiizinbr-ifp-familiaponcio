import { describe, it, expect } from "vitest";
import {
  decodeEntidadesHtml,
  limparConselho,
  limparRegistro,
} from "../../src/lib/migracao-amplimed/conselho";

describe("decodeEntidadesHtml", () => {
  it("decodifica &#x2F; em barra", () => {
    expect(decodeEntidadesHtml("05&#x2F;68179")).toBe("05/68179");
  });
  it("decodifica dupla/tripla codificação (&amp;amp;#x2F;)", () => {
    expect(decodeEntidadesHtml("52-0131605-2&amp;amp;#x2F;RJ")).toBe("52-0131605-2/RJ");
  });
  it("texto limpo passa intacto", () => {
    expect(decodeEntidadesHtml("52123")).toBe("52123");
  });
});

describe("limparConselho", () => {
  it("normaliza sigla válida", () => {
    expect(limparConselho("CRM")).toBe("CRM");
    expect(limparConselho(" crm ")).toBe("CRM");
    expect(limparConselho("CRESS")).toBe("CRESS");
  });
  it("vazio ou lixo vira string vazia", () => {
    expect(limparConselho(null)).toBe("");
    expect(limparConselho("")).toBe("");
    expect(limparConselho("123")).toBe("");
  });
});

describe("limparRegistro", () => {
  it("dígito repetido (lixo) vira vazio", () => {
    expect(limparRegistro("2222222222222222222222222", "RJ")).toBe("");
  });
  it("decodifica entidade HTML", () => {
    expect(limparRegistro("05&#x2F;68179", "RJ")).toBe("05/68179");
  });
  it("colapsa espaços e remove UF redundante no fim", () => {
    expect(limparRegistro("0000000013358    RJ", "RJ")).toBe("0000000013358");
  });
  it("decodifica + remove UF redundante (/RJ)", () => {
    expect(limparRegistro("52-0131605-2&amp;amp;#x2F;RJ", "RJ")).toBe("52-0131605-2");
  });
  it("registro válido simples passa", () => {
    expect(limparRegistro("52123", "RJ")).toBe("52123");
  });
  it("UF no INÍCIO não é removida", () => {
    expect(limparRegistro("RJ-CD-60017", "RJ")).toBe("RJ-CD-60017");
  });
  it("vazio vira vazio", () => {
    expect(limparRegistro(null, "RJ")).toBe("");
    expect(limparRegistro("   ", "RJ")).toBe("");
  });
});
