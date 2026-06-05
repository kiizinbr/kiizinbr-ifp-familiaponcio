import { describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import { configuracoesNavItem } from "@/lib/nav";
import type { RoleName, UnitScope } from "@/lib/rbac-types";

function sessionWith(roles: { name: RoleName; unitScope: UnitScope | null }[]): Session {
  return {
    user: {
      id: "u1",
      email: "x@y.z",
      name: null,
      roles,
      primaryRole: roles[0] as Session["user"]["primaryRole"],
    },
    expires: "2099-01-01",
  } as Session;
}

describe("configuracoesNavItem", () => {
  it("super_admin recebe o atalho de Configurações", () => {
    const erick = sessionWith([{ name: "super_admin", unitScope: null }]);
    expect(configuracoesNavItem(erick)).toEqual({
      label: "Configurações",
      href: "/admin/users",
    });
  });

  it("quem não é super_admin não recebe (null)", () => {
    const raquel = sessionWith([{ name: "gestor_unidade", unitScope: "medico" }]);
    expect(configuracoesNavItem(raquel)).toBeNull();
  });
});
