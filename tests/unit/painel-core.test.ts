import { describe, expect, it } from "vitest";
import {
  anuncioVigente,
  destinoFixoValido,
  extrairYoutubeId,
  fraseChamada,
  nomeChamado,
} from "@/lib/painel/core";

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

describe("destinoFixoValido", () => {
  it("aceita os destinos fixos Recepcao e Triagem", () => {
    expect(destinoFixoValido("Recepcao")).toBe(true);
    expect(destinoFixoValido("Triagem")).toBe(true);
  });
  it("rejeita texto livre / nome forjado (profissional e checado no banco, nao aqui)", () => {
    expect(destinoFixoValido("Dr. Fulano")).toBe(false);
    expect(destinoFixoValido("recepcao")).toBe(false); // case-sensitive
    expect(destinoFixoValido("")).toBe(false);
    expect(destinoFixoValido("Spoof")).toBe(false);
  });
});

describe("extrairYoutubeId", () => {
  it("extrai id de youtu.be", () => {
    expect(extrairYoutubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("extrai id de watch?v=", () => {
    expect(extrairYoutubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("extrai id de embed/ e shorts/", () => {
    expect(extrairYoutubeId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extrairYoutubeId("https://youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("retorna null para url invalida / texto / playlist sem video", () => {
    expect(extrairYoutubeId("https://youtube.com/playlist?list=PLxxxx")).toBeNull();
    expect(extrairYoutubeId("qualquer texto")).toBeNull();
    expect(extrairYoutubeId("https://exemplo.com")).toBeNull();
  });
  it("retorna null para null / vazio (limpar o video e valido)", () => {
    expect(extrairYoutubeId(null)).toBeNull();
    expect(extrairYoutubeId("")).toBeNull();
  });
});
