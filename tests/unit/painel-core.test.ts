import { describe, expect, it } from "vitest";
import { anuncioVigente, fraseChamada, nomeChamado } from "@/lib/painel/core";

describe("nomeChamado", () => {
  it("usa nomeSocial quando preenchido", () => {
    expect(nomeChamado({ nomeSocial: "Maria", nomeCompleto: "Maria da Silva" })).toBe("Maria");
  });
  it("cai no nomeCompleto quando nomeSocial e null", () => {
    expect(nomeChamado({ nomeSocial: null, nomeCompleto: "Maria da Silva" })).toBe(
      "Maria da Silva",
    );
  });
  it("cai no nomeCompleto quando nomeSocial e so espacos", () => {
    expect(nomeChamado({ nomeSocial: "  ", nomeCompleto: "Maria da Silva" })).toBe(
      "Maria da Silva",
    );
  });
});

describe("anuncioVigente", () => {
  const agora = new Date("2026-06-06T12:00:00Z");
  it("sem prazo (ativoAte null) -> vigente", () => {
    expect(anuncioVigente({ ativoAte: null }, agora)).toBe(true);
  });
  it("prazo no futuro -> vigente", () => {
    expect(anuncioVigente({ ativoAte: new Date("2026-06-07T00:00:00Z") }, agora)).toBe(true);
  });
  it("prazo no passado -> nao vigente", () => {
    expect(anuncioVigente({ ativoAte: new Date("2026-06-05T00:00:00Z") }, agora)).toBe(false);
  });
});

describe("fraseChamada", () => {
  it("monta nome + destino", () => {
    expect(fraseChamada("Maria", "Triagem")).toBe("Maria, Triagem");
  });
});
