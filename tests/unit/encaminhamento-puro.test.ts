import { describe, expect, it } from "vitest";
import {
  podeTransicionarEncaminhamento,
  TRANSICOES_ENCAMINHAMENTO,
} from "@/lib/medico/encaminhamento";

// Núcleo PURO: máquina de estados do encaminhamento. Sem DB.
describe("podeTransicionarEncaminhamento (máquina de estados)", () => {
  it("aguardando_agendamento → agendado é válido", () => {
    expect(podeTransicionarEncaminhamento("aguardando_agendamento", "agendado")).toBe(true);
  });
  it("aguardando_agendamento → cancelado é válido", () => {
    expect(podeTransicionarEncaminhamento("aguardando_agendamento", "cancelado")).toBe(true);
  });
  it("agendado → cancelado é inválido (terminal)", () => {
    expect(podeTransicionarEncaminhamento("agendado", "cancelado")).toBe(false);
  });
  it("cancelado → agendado é inválido (terminal)", () => {
    expect(podeTransicionarEncaminhamento("cancelado", "agendado")).toBe(false);
  });
  it("estados terminais têm conjunto de transições vazio", () => {
    expect(TRANSICOES_ENCAMINHAMENTO.agendado.size).toBe(0);
    expect(TRANSICOES_ENCAMINHAMENTO.cancelado.size).toBe(0);
  });
});
