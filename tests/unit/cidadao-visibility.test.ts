import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import type { Session } from "next-auth";
import { redactCidadaoSensiveis } from "@/lib/cidadao";
import { podeVerSaudeCidadao, podeVerSocioCidadao } from "@/lib/rbac";

/**
 * B1 — enforcement de PHI/socioeconômico na CAMADA DE DADOS.
 * `redactCidadaoSensiveis` é pura: nula os campos clínicos (saúde) sem
 * podeVerSaude e os socioeconômicos sem podeVerSocio, sem mutar o original.
 */

function fixtureCidadao() {
  return {
    id: "c1",
    nomeCompleto: "Maria Almeida",
    cpf: "12345678900",
    // saúde (PHI)
    tipoSanguineo: "O+",
    alergias: "dipirona",
    medicamentosEmUso: "losartana",
    condicoesCronicas: "hipertensão",
    // socioeconômico
    rendaFamiliar: new Prisma.Decimal(1200),
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

describe("redactCidadaoSensiveis", () => {
  it("nula os campos de saúde quando !podeVerSaude (mantém socio e públicos)", () => {
    const out = redactCidadaoSensiveis(fixtureCidadao(), {
      podeVerSaude: false,
      podeVerSocio: true,
    });
    expect(out.tipoSanguineo).toBeNull();
    expect(out.alergias).toBeNull();
    expect(out.medicamentosEmUso).toBeNull();
    expect(out.condicoesCronicas).toBeNull();
    // socio preservado
    expect(out.pessoasNaCasa).toBe(4);
    expect(out.beneficioSocial).toBe("bolsa_familia");
    // público preservado
    expect(out.nomeCompleto).toBe("Maria Almeida");
  });

  it("nula os campos socioeconômicos quando !podeVerSocio (mantém saúde)", () => {
    const out = redactCidadaoSensiveis(fixtureCidadao(), {
      podeVerSaude: true,
      podeVerSocio: false,
    });
    expect(out.rendaFamiliar).toBeNull();
    expect(out.pessoasNaCasa).toBeNull();
    expect(out.beneficioSocial).toBeNull();
    expect(out.escolaridade).toBeNull();
    expect(out.trabalha).toBeNull();
    expect(out.trabalhoDescricao).toBeNull();
    // saúde preservada
    expect(out.tipoSanguineo).toBe("O+");
  });

  it("nula AMBOS os blocos quando sem nenhuma capability", () => {
    const out = redactCidadaoSensiveis(fixtureCidadao(), {
      podeVerSaude: false,
      podeVerSocio: false,
    });
    expect(out.alergias).toBeNull();
    expect(out.rendaFamiliar).toBeNull();
  });

  it("preserva tudo quando tem ambas as capabilities", () => {
    const out = redactCidadaoSensiveis(fixtureCidadao(), {
      podeVerSaude: true,
      podeVerSocio: true,
    });
    expect(out.tipoSanguineo).toBe("O+");
    expect(out.beneficioSocial).toBe("bolsa_familia");
  });

  it("é imutável — não muta o objeto original", () => {
    const original = fixtureCidadao();
    redactCidadaoSensiveis(original, { podeVerSaude: false, podeVerSocio: false });
    expect(original.tipoSanguineo).toBe("O+");
    expect(original.beneficioSocial).toBe("bolsa_familia");
  });
});

describe("podeVerSaudeCidadao", () => {
  it("permite gestão e profissional, nega recepção/social", () => {
    expect(
      podeVerSaudeCidadao(sessionComRoles({ name: "profissional", unitScope: "medico" })),
    ).toBe(true);
    expect(
      podeVerSaudeCidadao(sessionComRoles({ name: "gestor_unidade", unitScope: "medico" })),
    ).toBe(true);
    expect(podeVerSaudeCidadao(sessionComRoles({ name: "recepcao", unitScope: "medico" }))).toBe(
      false,
    );
    expect(podeVerSaudeCidadao(sessionComRoles({ name: "social", unitScope: null }))).toBe(false);
    expect(podeVerSaudeCidadao(null)).toBe(false);
  });
});

describe("podeVerSocioCidadao", () => {
  it("permite social/presidência/super_admin, nega profissional/recepção", () => {
    expect(podeVerSocioCidadao(sessionComRoles({ name: "social", unitScope: null }))).toBe(true);
    expect(podeVerSocioCidadao(sessionComRoles({ name: "presidencia", unitScope: null }))).toBe(
      true,
    );
    expect(
      podeVerSocioCidadao(sessionComRoles({ name: "profissional", unitScope: "medico" })),
    ).toBe(false);
    expect(podeVerSocioCidadao(sessionComRoles({ name: "recepcao", unitScope: "medico" }))).toBe(
      false,
    );
    expect(podeVerSocioCidadao(null)).toBe(false);
  });
});
