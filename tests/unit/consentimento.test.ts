import { describe, it, expect } from "vitest";
import {
  statusConsentimento,
  VERSAO_TERMO_TRATAMENTO,
  type ConsentimentoRec,
} from "@/lib/consentimento";

function rec(p: Partial<ConsentimentoRec> & Pick<ConsentimentoRec, "tipo">): ConsentimentoRec {
  return {
    versao: VERSAO_TERMO_TRATAMENTO,
    imagemInterno: false,
    imagemRedes: false,
    imagemImprensa: false,
    revogadoEm: null,
    ...p,
  };
}

describe("statusConsentimento", () => {
  it("sem registros → tratamento não vigente, imagem tudo falso", () => {
    const s = statusConsentimento([]);
    expect(s.tratamento.vigente).toBe(false);
    expect(s.imagem.interno).toBe(false);
  });

  it("tratamento vigente na versão atual → vigente, não desatualizado", () => {
    const s = statusConsentimento([rec({ tipo: "tratamento_dados" })]);
    expect(s.tratamento.vigente).toBe(true);
    expect(s.tratamento.desatualizado).toBe(false);
  });

  it("tratamento numa versão antiga → desatualizado", () => {
    const s = statusConsentimento([rec({ tipo: "tratamento_dados", versao: "v0-2020" })]);
    expect(s.tratamento.vigente).toBe(true);
    expect(s.tratamento.desatualizado).toBe(true);
  });

  it("tratamento revogado → não vigente", () => {
    const s = statusConsentimento([
      rec({ tipo: "tratamento_dados", revogadoEm: new Date("2026-01-01") }),
    ]);
    expect(s.tratamento.vigente).toBe(false);
  });

  it("imagem granular: só redes autorizado", () => {
    const s = statusConsentimento([rec({ tipo: "imagem", imagemRedes: true })]);
    expect(s.imagem.redes).toBe(true);
    expect(s.imagem.interno).toBe(false);
    expect(s.imagem.imprensa).toBe(false);
  });
});
