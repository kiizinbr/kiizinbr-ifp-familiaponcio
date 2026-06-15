import { describe, expect, it } from "vitest";
import {
  UNIDADES,
  UNIDADE_SLUGS,
  isUnidadePainel,
  unidadeFromSlug,
  unidadesAcessiveis,
  type UnidadeSlug,
} from "@/lib/unidades";

describe("unidades — config canônica", () => {
  it("expõe 6 slugs em UNIDADE_SLUGS", () => {
    expect(UNIDADE_SLUGS).toEqual([
      "medico",
      "capacitacao",
      "esportivo",
      "recreativo",
      "poncio",
      "social",
    ]);
  });

  it("UNIDADES tem entrada para cada slug com campos obrigatórios", () => {
    for (const slug of UNIDADE_SLUGS) {
      const u = UNIDADES[slug];
      expect(u.slug).toBe(slug);
      expect(u.nome).toBeTruthy();
      expect(u.corFiltroLogin).toMatch(/^#[0-9a-f]{6}$/i);
      expect(u.gradienteFallback).toMatch(/linear-gradient/);
      expect(Array.isArray(u.rolesAceitas)).toBe(true);
    }
  });

  it("filtros temáticos seguem mapeamento canônico do brandbook", () => {
    expect(UNIDADES.medico.corFiltroLogin).toBe("#007571");
    expect(UNIDADES.capacitacao.corFiltroLogin).toBe("#FF772E");
    expect(UNIDADES.esportivo.corFiltroLogin).toBe("#C24D0F");
    expect(UNIDADES.recreativo.corFiltroLogin).toBe("#10C2BB");
    expect(UNIDADES.poncio.corFiltroLogin).toBe("#752C05");
    expect(UNIDADES.social.corFiltroLogin).toBe("#4A4A49");
  });

  it("rolesAceitas reflete a matriz da spec", () => {
    expect(UNIDADES.medico.rolesAceitas).toContainEqual({
      name: "gestor_unidade",
      unitScope: "medico",
    });
    expect(UNIDADES.medico.rolesAceitas).toContainEqual({
      name: "recepcao",
      unitScope: "medico",
    });
    expect(UNIDADES.poncio.rolesAceitas).toContainEqual({
      name: "presidencia",
      unitScope: null,
    });
    expect(UNIDADES.social.rolesAceitas).toContainEqual({
      name: "social",
      unitScope: null,
    });
  });
});

describe("unidadeFromSlug", () => {
  it("retorna config para slug válido", () => {
    expect(unidadeFromSlug("medico")?.nome).toBe("Centro Médico");
    expect(unidadeFromSlug("poncio")?.nome).toBe("Pôncio Executivo");
  });

  it("retorna null para slug inválido", () => {
    expect(unidadeFromSlug("xyz")).toBeNull();
    expect(unidadeFromSlug("")).toBeNull();
    expect(unidadeFromSlug("MEDICO")).toBeNull();
  });
});

describe("unidadesAcessiveis", () => {
  const erickRoles = [{ name: "super_admin" as const, unitScope: null }];
  const raquelRoles = [{ name: "gestor_unidade" as const, unitScope: "medico" as const }];
  const sauloRoles = [{ name: "presidencia" as const, unitScope: null }];
  const reginaRoles = [{ name: "social" as const, unitScope: null }];

  it("super_admin acessa todas as 6", () => {
    expect(unidadesAcessiveis(erickRoles).sort()).toEqual([...UNIDADE_SLUGS].sort());
  });

  it("gestor_unidade:medico acessa só /medico", () => {
    expect(unidadesAcessiveis(raquelRoles)).toEqual(["medico"]);
  });

  it("presidencia acessa só /poncio", () => {
    expect(unidadesAcessiveis(sauloRoles)).toEqual(["poncio"]);
  });

  it("social acessa só /social", () => {
    expect(unidadesAcessiveis(reginaRoles)).toEqual(["social"]);
  });

  it("gestor_unidade:esportivo NÃO inclui /medico (apenas /esportivo)", () => {
    const roles = [{ name: "gestor_unidade" as const, unitScope: "esportivo" as const }];
    expect(unidadesAcessiveis(roles)).toEqual(["esportivo"]);
  });

  it("array de roles vazio retorna []", () => {
    expect(unidadesAcessiveis([])).toEqual([]);
  });
});

describe("isUnidadePainel", () => {
  it("as 4 operacionais (cidadaoScope self) tem painel de fila", () => {
    expect(isUnidadePainel("medico")).toBe(true);
    expect(isUnidadePainel("capacitacao")).toBe(true);
    expect(isUnidadePainel("esportivo")).toBe(true);
    expect(isUnidadePainel("recreativo")).toBe(true);
  });

  it("poncio e social (cidadaoScope all) NAO tem painel", () => {
    expect(isUnidadePainel("poncio")).toBe(false);
    expect(isUnidadePainel("social")).toBe(false);
  });

  it("slug inexistente -> false", () => {
    expect(isUnidadePainel("xyz")).toBe(false);
    expect(isUnidadePainel("")).toBe(false);
  });
});
