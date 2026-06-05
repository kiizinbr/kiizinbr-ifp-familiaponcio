import { describe, it, expect } from "vitest";
import type { Session } from "next-auth";
import { omitCamposSensiveisSemPermissao } from "@/lib/cidadao";
import { podeEditarSaudeCidadao, podeEditarSocioCidadao } from "@/lib/rbac";

/**
 * B2 — escrita de campos sensíveis gated por capability na CAMADA DE DADOS.
 * `omitCamposSensiveisSemPermissao` remove (não nula) os campos que o caller
 * não pode escrever, ANTES do update — preservando o valor existente no banco.
 */

function fixtureUpdate() {
  return {
    nomeCompleto: "Maria Almeida",
    telefonePrincipal: "11999990000",
    // saúde
    tipoSanguineo: "O+",
    alergias: "dipirona",
    medicamentosEmUso: "losartana",
    condicoesCronicas: "hipertensão",
    // socioeconômico
    rendaFamiliar: "1200.00",
    pessoasNaCasa: 4,
    beneficioSocial: "bolsa_familia",
    escolaridade: "fundamental",
    trabalha: true,
    trabalhoDescricao: "diarista",
  };
}

function sessionComRoles(...roles: { name: string; unitScope: string | null }[]): Session {
  return { user: { id: "u1", roles } } as unknown as Session;
}

describe("omitCamposSensiveisSemPermissao", () => {
  it("remove os campos de saúde quando !podeEscreverSaude (mantém socio + básico)", () => {
    const out = omitCamposSensiveisSemPermissao(fixtureUpdate(), {
      podeEscreverSaude: false,
      podeEscreverSocio: true,
    });
    expect("tipoSanguineo" in out).toBe(false);
    expect("alergias" in out).toBe(false);
    expect("medicamentosEmUso" in out).toBe(false);
    expect("condicoesCronicas" in out).toBe(false);
    // socio + básico preservados
    expect("beneficioSocial" in out).toBe(true);
    expect("nomeCompleto" in out).toBe(true);
  });

  it("remove os campos socioeconômicos quando !podeEscreverSocio (mantém saúde)", () => {
    const out = omitCamposSensiveisSemPermissao(fixtureUpdate(), {
      podeEscreverSaude: true,
      podeEscreverSocio: false,
    });
    expect("rendaFamiliar" in out).toBe(false);
    expect("pessoasNaCasa" in out).toBe(false);
    expect("trabalha" in out).toBe(false);
    expect("alergias" in out).toBe(true);
  });

  it("remove AMBOS os blocos sem nenhuma permissão (sobra só o básico)", () => {
    const out = omitCamposSensiveisSemPermissao(fixtureUpdate(), {
      podeEscreverSaude: false,
      podeEscreverSocio: false,
    });
    expect("alergias" in out).toBe(false);
    expect("rendaFamiliar" in out).toBe(false);
    expect("nomeCompleto" in out).toBe(true);
    expect("telefonePrincipal" in out).toBe(true);
  });

  it("preserva todos os campos quando tem ambas as permissões", () => {
    const out = omitCamposSensiveisSemPermissao(fixtureUpdate(), {
      podeEscreverSaude: true,
      podeEscreverSocio: true,
    });
    expect(Object.keys(out).sort()).toEqual(Object.keys(fixtureUpdate()).sort());
  });

  it("é imutável — não remove chaves do objeto original", () => {
    const original = fixtureUpdate();
    omitCamposSensiveisSemPermissao(original, {
      podeEscreverSaude: false,
      podeEscreverSocio: false,
    });
    expect("alergias" in original).toBe(true);
    expect("rendaFamiliar" in original).toBe(true);
  });
});

describe("podeEditarSaudeCidadao", () => {
  it("permite gestão e profissional, nega recepção/social", () => {
    expect(
      podeEditarSaudeCidadao(sessionComRoles({ name: "profissional", unitScope: "medico" })),
    ).toBe(true);
    expect(
      podeEditarSaudeCidadao(sessionComRoles({ name: "gestor_unidade", unitScope: "medico" })),
    ).toBe(true);
    expect(podeEditarSaudeCidadao(sessionComRoles({ name: "recepcao", unitScope: "medico" }))).toBe(
      false,
    );
    expect(podeEditarSaudeCidadao(sessionComRoles({ name: "social", unitScope: null }))).toBe(
      false,
    );
    expect(podeEditarSaudeCidadao(null)).toBe(false);
  });
});

describe("podeEditarSocioCidadao", () => {
  it("permite social/super_admin, nega presidência (view-only)/profissional/recepção", () => {
    expect(podeEditarSocioCidadao(sessionComRoles({ name: "social", unitScope: null }))).toBe(true);
    expect(podeEditarSocioCidadao(sessionComRoles({ name: "super_admin", unitScope: null }))).toBe(
      true,
    );
    expect(podeEditarSocioCidadao(sessionComRoles({ name: "presidencia", unitScope: null }))).toBe(
      false,
    );
    expect(
      podeEditarSocioCidadao(sessionComRoles({ name: "profissional", unitScope: "medico" })),
    ).toBe(false);
    expect(podeEditarSocioCidadao(null)).toBe(false);
  });
});
