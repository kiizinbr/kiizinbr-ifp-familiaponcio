import { describe, expect, it } from "vitest";
import { buscaCidadaoValida, buildBuscaCidadaoWhere } from "@/lib/medico/busca-cidadao";

// Fatia 1 — busca de cidadão no wizard /medico/consultas/nova.
// A lógica de filtro REUSA buildCidadaoSearchFilter (índices trigram, já testado),
// só acrescenta o escopo do médico: nunca casar soft-deletados/anonimizados.

describe("buscaCidadaoValida", () => {
  it("rejeita query curta/vazia/whitespace (< 2 chars úteis)", () => {
    expect(buscaCidadaoValida("")).toBe(false);
    expect(buscaCidadaoValida(" ")).toBe(false);
    expect(buscaCidadaoValida("a")).toBe(false);
    expect(buscaCidadaoValida("  a  ")).toBe(false);
  });

  it("aceita query com 2+ chars úteis", () => {
    expect(buscaCidadaoValida("An")).toBe(true);
    expect(buscaCidadaoValida("Maria")).toBe(true);
    expect(buscaCidadaoValida("  Ana  ")).toBe(true);
  });
});

describe("buildBuscaCidadaoWhere", () => {
  it("busca por NOME não gera cláusulas cpf/telefone e exclui deletados/anonimizados", () => {
    // Regressão do LIKE quebrado: nome puro não pode virar { cpf: { contains: '' } }
    // (LIKE '%%' casa TODOS). E o wizard nunca pode oferecer ficha apagada/anonimizada.
    expect(buildBuscaCidadaoWhere("Maria")).toEqual({
      deletedAt: null,
      anonimizadoEm: null,
      OR: [
        { nomeCompleto: { contains: "Maria", mode: "insensitive" } },
        { nomeSocial: { contains: "Maria", mode: "insensitive" } },
      ],
    });
  });

  it("busca com CPF formatado adiciona cláusulas cpf/telefone só com dígitos", () => {
    expect(buildBuscaCidadaoWhere("123.456.789-09")).toEqual({
      deletedAt: null,
      anonimizadoEm: null,
      OR: [
        { nomeCompleto: { contains: "123.456.789-09", mode: "insensitive" } },
        { nomeSocial: { contains: "123.456.789-09", mode: "insensitive" } },
        { cpf: { contains: "12345678909" } },
        { telefonePrincipal: { contains: "12345678909" } },
      ],
    });
  });

  it("aplica trim antes de montar o filtro", () => {
    expect(buildBuscaCidadaoWhere("  Ana  ")).toEqual({
      deletedAt: null,
      anonimizadoEm: null,
      OR: [
        { nomeCompleto: { contains: "Ana", mode: "insensitive" } },
        { nomeSocial: { contains: "Ana", mode: "insensitive" } },
      ],
    });
  });
});
