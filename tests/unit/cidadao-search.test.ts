import { describe, expect, it } from "vitest";
import { buildCidadaoSearchFilter } from "@/lib/cidadao";

describe("buildCidadaoSearchFilter", () => {
  it("busca vazia/undefined/whitespace retorna filtro vazio (lista todos)", () => {
    expect(buildCidadaoSearchFilter(undefined)).toEqual({});
    expect(buildCidadaoSearchFilter("")).toEqual({});
    expect(buildCidadaoSearchFilter("   ")).toEqual({});
  });

  it("busca por NOME não gera cláusulas cpf/telefone (evita contains:'' que casa tudo)", () => {
    // Regressão do achado #2: normalizeCpf('Maria') === '' e
    // { cpf: { contains: '' } } vira LIKE '%%', retornando TODOS os cidadãos.
    expect(buildCidadaoSearchFilter("Maria")).toEqual({
      OR: [
        { nomeCompleto: { contains: "Maria", mode: "insensitive" } },
        { nomeSocial: { contains: "Maria", mode: "insensitive" } },
      ],
    });
  });

  it("aplica trim antes de montar o filtro", () => {
    expect(buildCidadaoSearchFilter("  Ana  ")).toEqual({
      OR: [
        { nomeCompleto: { contains: "Ana", mode: "insensitive" } },
        { nomeSocial: { contains: "Ana", mode: "insensitive" } },
      ],
    });
  });

  it("busca com CPF formatado adiciona cláusulas cpf e telefone só com dígitos", () => {
    expect(buildCidadaoSearchFilter("123.456.789-09")).toEqual({
      OR: [
        { nomeCompleto: { contains: "123.456.789-09", mode: "insensitive" } },
        { nomeSocial: { contains: "123.456.789-09", mode: "insensitive" } },
        { cpf: { contains: "12345678909" } },
        { telefonePrincipal: { contains: "12345678909" } },
      ],
    });
  });

  it("busca só com dígitos (telefone) adiciona cpf e telefone", () => {
    expect(buildCidadaoSearchFilter("11999998888")).toEqual({
      OR: [
        { nomeCompleto: { contains: "11999998888", mode: "insensitive" } },
        { nomeSocial: { contains: "11999998888", mode: "insensitive" } },
        { cpf: { contains: "11999998888" } },
        { telefonePrincipal: { contains: "11999998888" } },
      ],
    });
  });
});
