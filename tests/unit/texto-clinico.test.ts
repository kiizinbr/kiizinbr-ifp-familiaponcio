import { describe, expect, it } from "vitest";
import { chipsClinicos, limparTextoClinico } from "@/lib/texto-clinico";

// F2 (higiene da ficha) — molde de cidadao-search.test.ts: funções puras, sem DB.
// Caso real: Cidadao.alergias migrado da Amplimed com `<br>` literal (rich-text
// migrado 1:1; o React escapa e a tag aparece como texto na UI).

describe("limparTextoClinico", () => {
  it("converte <br> em quebra de linha", () => {
    expect(limparTextoClinico("Dipirona<br>Penicilina")).toBe("Dipirona\nPenicilina");
  });

  it("converte as variações <br/>, <br /> e <BR > (case/espaço/barra)", () => {
    expect(limparTextoClinico("a<br/>b")).toBe("a\nb");
    expect(limparTextoClinico("a<br />b")).toBe("a\nb");
    expect(limparTextoClinico("a<BR >b")).toBe("a\nb");
  });

  it("remove tags restantes, inclusive aninhadas", () => {
    expect(limparTextoClinico("<p><strong>Rinite</strong> alérgica</p>")).toBe("Rinite alérgica");
    expect(limparTextoClinico("<div><span>AAS</span></div>")).toBe("AAS");
  });

  it("decodifica entidades básicas (&nbsp; &amp; &lt; &gt; &quot;)", () => {
    expect(limparTextoClinico("Dipirona&nbsp;500mg")).toBe("Dipirona 500mg");
    expect(limparTextoClinico("Penicilina &amp; derivados")).toBe("Penicilina & derivados");
    expect(limparTextoClinico("PA &lt; 120 e &gt; 80")).toBe("PA < 120 e > 80");
    expect(limparTextoClinico("alergia &quot;grave&quot;")).toBe('alergia "grave"');
  });

  it("texto já limpo passa intacto", () => {
    expect(limparTextoClinico("Dipirona, AAS")).toBe("Dipirona, AAS");
    expect(limparTextoClinico("Linha 1\nLinha 2")).toBe("Linha 1\nLinha 2");
  });

  it("colapsa whitespace horizontal preservando \\n e descarta linhas vazias", () => {
    expect(limparTextoClinico("Dipirona   500mg <br><br>  AAS ")).toBe("Dipirona 500mg\nAAS");
    expect(limparTextoClinico("a\n\n\nb")).toBe("a\nb");
  });

  it("entrada vazia/null/undefined → string vazia", () => {
    expect(limparTextoClinico("")).toBe("");
    expect(limparTextoClinico(null)).toBe("");
    expect(limparTextoClinico(undefined)).toBe("");
  });

  it("string só de HTML/whitespace → string vazia", () => {
    expect(limparTextoClinico("<br><br>")).toBe("");
    expect(limparTextoClinico("<p>&nbsp;</p>")).toBe("");
  });
});

describe("chipsClinicos", () => {
  it("divide por vírgula e ponto-e-vírgula", () => {
    expect(chipsClinicos("Dipirona, AAS; Penicilina")).toEqual(["Dipirona", "AAS", "Penicilina"]);
  });

  it("divide pelo \\n vindo de <br> legado (caso real da migração)", () => {
    expect(chipsClinicos("Dipirona<br>Penicilina<br/>Rinite")).toEqual([
      "Dipirona",
      "Penicilina",
      "Rinite",
    ]);
  });

  it("aplica trim e filtra itens vazios", () => {
    expect(chipsClinicos("  Dipirona ,, ; <br> AAS  ")).toEqual(["Dipirona", "AAS"]);
  });

  it("entrada vazia/null/undefined → []", () => {
    expect(chipsClinicos("")).toEqual([]);
    expect(chipsClinicos(null)).toEqual([]);
    expect(chipsClinicos(undefined)).toEqual([]);
  });
});
