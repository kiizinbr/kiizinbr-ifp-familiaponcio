import { describe, it, expect } from "vitest";
import { escopoCoerente, criarUsuarioSchema } from "@/lib/admin/user-schema";

/**
 * Fase 1 / Identidade — provisionamento de conta. Validação pura da coerência
 * papel↔unidade: papel global (super_admin/presidencia/social) NÃO leva unidade;
 * papel de unidade (gestor_unidade/profissional/recepcao) EXIGE unidade.
 */

describe("escopoCoerente", () => {
  it("papel global exige unitScope null", () => {
    expect(escopoCoerente("super_admin", null)).toBe(true);
    expect(escopoCoerente("social", null)).toBe(true);
    expect(escopoCoerente("presidencia", "medico")).toBe(false);
  });

  it("papel de unidade exige unitScope setado", () => {
    expect(escopoCoerente("gestor_unidade", "medico")).toBe(true);
    expect(escopoCoerente("profissional", "capacitacao")).toBe(true);
    expect(escopoCoerente("recepcao", null)).toBe(false);
  });
});

describe("criarUsuarioSchema", () => {
  const ok = {
    name: "Raquel",
    email: "Raquel@Ex.com",
    password: "senha1234",
    roleName: "gestor_unidade",
    unitScope: "medico",
  };

  it("aceita gestor_unidade + medico e normaliza email (trim+lowercase)", () => {
    const r = criarUsuarioSchema.safeParse(ok);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("raquel@ex.com");
  });

  it("aceita papel global com unitScope vazio (vira null)", () => {
    const r = criarUsuarioSchema.safeParse({ ...ok, roleName: "social", unitScope: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.unitScope).toBeNull();
  });

  it("rejeita papel de unidade sem unidade", () => {
    expect(criarUsuarioSchema.safeParse({ ...ok, unitScope: "" }).success).toBe(false);
  });

  it("rejeita papel global COM unidade", () => {
    expect(
      criarUsuarioSchema.safeParse({ ...ok, roleName: "presidencia", unitScope: "medico" }).success,
    ).toBe(false);
  });

  it("rejeita senha curta e e-mail inválido", () => {
    expect(criarUsuarioSchema.safeParse({ ...ok, password: "123" }).success).toBe(false);
    expect(criarUsuarioSchema.safeParse({ ...ok, email: "naoeh" }).success).toBe(false);
  });
});
