import { describe, expect, it } from "vitest";
import { deveAtivarCidadao } from "@/lib/triagem";

describe("deveAtivarCidadao", () => {
  it("retorna true se ao menos uma elegibilidade está aprovada", () => {
    expect(deveAtivarCidadao([{ status: "pendente" }, { status: "aprovado" }])).toBe(true);
  });

  it("retorna false se nenhuma está aprovada", () => {
    expect(deveAtivarCidadao([{ status: "pendente" }, { status: "negado" }])).toBe(false);
  });

  it("retorna false para lista vazia (nenhuma decisão ainda)", () => {
    expect(deveAtivarCidadao([])).toBe(false);
  });

  it("encaminhado/negado não ativam — só aprovado conta", () => {
    expect(deveAtivarCidadao([{ status: "encaminhado" }, { status: "negado" }])).toBe(false);
  });
});
