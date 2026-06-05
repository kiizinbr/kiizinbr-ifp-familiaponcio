import { describe, it, expect } from "vitest";
import { dadosAnonimizadosCidadao, dadosAnonimizadosEndereco } from "@/lib/cidadao";

/**
 * D1 — anonimização LGPD (direito ao esquecimento). As funções de mascaramento
 * são puras: mascaram/nulam PII de forma IRREVERSÍVEL. A action grava o resultado.
 */

describe("dadosAnonimizadosCidadao", () => {
  const cidadao = { id: "cabc123", dataNascimento: new Date(Date.UTC(1990, 5, 15)) };

  it("mascara os obrigatórios identificáveis (cpf preserva @unique via id)", () => {
    const d = dadosAnonimizadosCidadao(cidadao);
    expect(d.nomeCompleto).toBe("[anonimizado]");
    expect(d.cpf).toBe("ANON-cabc123");
    expect(d.telefonePrincipal).toBe("[anonimizado]");
  });

  it("reduz dataNascimento a 1º de janeiro do ano (mantém faixa etária, perde data exata)", () => {
    const d = dadosAnonimizadosCidadao(cidadao);
    expect(d.dataNascimento.getUTCFullYear()).toBe(1990);
    expect(d.dataNascimento.getUTCMonth()).toBe(0);
    expect(d.dataNascimento.getUTCDate()).toBe(1);
  });

  it("nula PII opcional, foto, saúde e socioeconômico", () => {
    const d = dadosAnonimizadosCidadao(cidadao);
    expect(d.nomeSocial).toBeNull();
    expect(d.email).toBeNull();
    expect(d.nomeMae).toBeNull();
    expect(d.fotoUrl).toBeNull();
    expect(d.whatsappConsente).toBe(false);
    // saúde
    expect(d.alergias).toBeNull();
    expect(d.condicoesCronicas).toBeNull();
    // socioeconômico
    expect(d.rendaFamiliar).toBeNull();
    expect(d.beneficioSocial).toBeNull();
  });

  it("não inclui anonimizadoEm (a action grava o timestamp — função pura é determinística)", () => {
    const d = dadosAnonimizadosCidadao(cidadao);
    expect("anonimizadoEm" in d).toBe(false);
  });
});

describe("dadosAnonimizadosEndereco", () => {
  it("mascara logradouro/cep, nula numero/bairro, e NÃO mexe em cidade/uf (agregado territorial)", () => {
    const e = dadosAnonimizadosEndereco();
    expect(e.logradouro).toBe("[anonimizado]");
    expect(e.cep).toBe("00000000");
    expect(e.numero).toBeNull();
    expect(e.bairro).toBeNull();
    expect("cidade" in e).toBe(false);
    expect("uf" in e).toBe(false);
  });
});
