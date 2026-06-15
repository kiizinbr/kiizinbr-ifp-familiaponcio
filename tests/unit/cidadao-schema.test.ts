import { describe, it, expect } from "vitest";
import { cidadaoCreateSchema } from "@/lib/cidadao-schema";

/**
 * F11 — faixa plausível de dataNascimento (Zod, NÃO schema do banco).
 * O .refine encadeado após .pipe(.date()) rejeita datas futuras e idades
 * implausíveis (> 130 anos), cobrindo create E update (schema único).
 *
 * Datas são computadas relativas a hoje (não hardcoded de ano corrente) para o
 * teste não apodrecer com a passagem do tempo.
 */

/** AAAA-MM-DD a partir de uma data, em horário local (casa com o T00:00:00 do refine). */
function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dia}`;
}

function shiftYears(deltaYears: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + deltaYears);
  return toYmd(d);
}

describe("cidadaoCreateSchema — dataNascimento (F11)", () => {
  // rendaFamiliar/pessoasNaCasa são unions com .pipe que exigem a chave presente
  // (a UI sempre envia, mesmo que ""); incluídas pra isolar o teste em F11.
  const base = {
    nomeCompleto: "Maria da Silva",
    cpf: "123.456.789-09",
    telefonePrincipal: "11999998888",
    unitIdOrigem: "medico",
    rendaFamiliar: "",
    pessoasNaCasa: "",
  };

  function parseWith(dataNascimento: string) {
    return cidadaoCreateSchema.safeParse({ ...base, dataNascimento });
  }

  it("aceita base mínima válida com data plausível", () => {
    expect(parseWith("1990-05-12").success).toBe(true);
  });

  it("aceita data de hoje (nascido hoje é válido)", () => {
    expect(parseWith(toYmd(new Date())).success).toBe(true);
  });

  it("aceita exatamente 130 anos atrás (borda inclusa)", () => {
    expect(parseWith(shiftYears(-130)).success).toBe(true);
  });

  it("rejeita data futura", () => {
    expect(parseWith("2099-01-01").success).toBe(false);
    expect(parseWith(shiftYears(1)).success).toBe(false);
  });

  it("rejeita idade implausível (> 130 anos)", () => {
    expect(parseWith("1850-01-01").success).toBe(false);
    expect(parseWith(shiftYears(-131)).success).toBe(false);
  });

  it("rejeita formato inválido antes do refine (o .pipe(.date()) barra)", () => {
    expect(parseWith("12/05/1990").success).toBe(false);
    expect(parseWith("abc").success).toBe(false);
    expect(parseWith("").success).toBe(false);
  });
});
