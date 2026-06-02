import { describe, expect, it } from "vitest";
import {
  podeTransicionarMatricula,
  STATUS_OCUPA_VAGA,
  TRANSICOES_MATRICULA,
} from "@/lib/capacitacao/matricula";

// T3 (núcleo PURO): máquina de estados da matrícula (§0.7) + conjunto que ocupa vaga.
// Sem DB. O ralph-loop implementa matricula.ts até passar.

describe("podeTransicionarMatricula (máquina de estados)", () => {
  it("inscrito → confirmado é válido", () => {
    expect(podeTransicionarMatricula("inscrito", "confirmado")).toBe(true);
  });
  it("inscrito → cursando é inválido (pula etapa)", () => {
    expect(podeTransicionarMatricula("inscrito", "cursando")).toBe(false);
  });
  it("confirmado → cursando é válido", () => {
    expect(podeTransicionarMatricula("confirmado", "cursando")).toBe(true);
  });
  it("cursando → concluido é válido", () => {
    expect(podeTransicionarMatricula("cursando", "concluido")).toBe(true);
  });
  it("cursando → reprovado é válido", () => {
    expect(podeTransicionarMatricula("cursando", "reprovado")).toBe(true);
  });
  it("cursando → desistente é válido", () => {
    expect(podeTransicionarMatricula("cursando", "desistente")).toBe(true);
  });
  it("lista_espera → inscrito é válido (promoção)", () => {
    expect(podeTransicionarMatricula("lista_espera", "inscrito")).toBe(true);
  });
  it("concluido → cursando é inválido (terminal)", () => {
    expect(podeTransicionarMatricula("concluido", "cursando")).toBe(false);
  });
  it("cancelado → inscrito é inválido (terminal)", () => {
    expect(podeTransicionarMatricula("cancelado", "inscrito")).toBe(false);
  });
  it("estado terminal tem conjunto de transições vazio", () => {
    expect(TRANSICOES_MATRICULA.concluido.size).toBe(0);
  });
});

describe("STATUS_OCUPA_VAGA", () => {
  it("conta os status ativos (inscrito/confirmado/cursando)", () => {
    expect(STATUS_OCUPA_VAGA.has("inscrito")).toBe(true);
    expect(STATUS_OCUPA_VAGA.has("confirmado")).toBe(true);
    expect(STATUS_OCUPA_VAGA.has("cursando")).toBe(true);
  });
  it("NÃO conta lista de espera, cancelado nem concluído", () => {
    expect(STATUS_OCUPA_VAGA.has("lista_espera")).toBe(false);
    expect(STATUS_OCUPA_VAGA.has("cancelado")).toBe(false);
    expect(STATUS_OCUPA_VAGA.has("concluido")).toBe(false);
  });
});
