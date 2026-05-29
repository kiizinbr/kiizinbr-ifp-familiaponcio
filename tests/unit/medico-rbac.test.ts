import { describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import type { RoleName, UnitScope } from "@/lib/rbac-types";
import {
  podeConfigurarAgendaProfissional,
  podeGerenciarEspecialidade,
  podeGerenciarProfissional,
  podeMarcarConsulta,
  podeTransicionarConsulta,
} from "@/lib/medico/rbac";

function sessionWith(
  roles: { name: RoleName; unitScope: UnitScope | null }[],
  userId = "u1",
): Session {
  return {
    user: {
      id: userId,
      email: "x@y.z",
      name: null,
      roles,
      primaryRole: roles[0] ?? null,
    },
    expires: "2099-01-01",
  } as Session;
}

describe("podeGerenciarProfissional", () => {
  it("super_admin pode", () => {
    expect(podeGerenciarProfissional(sessionWith([{ name: "super_admin", unitScope: null }]))).toBe(
      true,
    );
  });
  it("gestor_unidade:medico pode", () => {
    expect(
      podeGerenciarProfissional(sessionWith([{ name: "gestor_unidade", unitScope: "medico" }])),
    ).toBe(true);
  });
  it("recepcao:medico NÃO pode", () => {
    expect(
      podeGerenciarProfissional(sessionWith([{ name: "recepcao", unitScope: "medico" }])),
    ).toBe(false);
  });
});

describe("podeConfigurarAgendaProfissional", () => {
  it("super_admin pode qualquer profissional", () => {
    expect(
      podeConfigurarAgendaProfissional(
        sessionWith([{ name: "super_admin", unitScope: null }]),
        "outro-user",
      ),
    ).toBe(true);
  });
  it("profissional pode a própria agenda", () => {
    const s = sessionWith([{ name: "profissional", unitScope: "medico" }], "user-X");
    expect(podeConfigurarAgendaProfissional(s, "user-X")).toBe(true);
  });
  it("profissional NÃO pode agenda de outro", () => {
    const s = sessionWith([{ name: "profissional", unitScope: "medico" }], "user-X");
    expect(podeConfigurarAgendaProfissional(s, "user-Y")).toBe(false);
  });
});

describe("podeMarcarConsulta", () => {
  it("recepcao:medico pode", () => {
    expect(podeMarcarConsulta(sessionWith([{ name: "recepcao", unitScope: "medico" }]))).toBe(true);
  });
  it("social pode (via encaminhamento)", () => {
    expect(podeMarcarConsulta(sessionWith([{ name: "social", unitScope: null }]))).toBe(true);
  });
  it("profissional NÃO marca consulta pra si (só follow-up no F1.B.2)", () => {
    expect(podeMarcarConsulta(sessionWith([{ name: "profissional", unitScope: "medico" }]))).toBe(
      false,
    );
  });
});

describe("podeTransicionarConsulta", () => {
  it("recepcao pode check-in / faltou", () => {
    const s = sessionWith([{ name: "recepcao", unitScope: "medico" }]);
    expect(podeTransicionarConsulta(s, "agendada", "em_atendimento", "outro")).toBe(true);
    expect(podeTransicionarConsulta(s, "agendada", "faltou", "outro")).toBe(true);
  });
  it("profissional pode marcar realizada na sua consulta", () => {
    const s = sessionWith([{ name: "profissional", unitScope: "medico" }], "user-X");
    expect(podeTransicionarConsulta(s, "em_atendimento", "realizada", "user-X")).toBe(true);
  });
  it("profissional NÃO transiciona consulta de outro profissional", () => {
    const s = sessionWith([{ name: "profissional", unitScope: "medico" }], "user-X");
    expect(podeTransicionarConsulta(s, "em_atendimento", "realizada", "user-Y")).toBe(false);
  });
});

describe("podeGerenciarEspecialidade", () => {
  it("super_admin sim, gestor sim, recepcao não", () => {
    expect(
      podeGerenciarEspecialidade(sessionWith([{ name: "super_admin", unitScope: null }])),
    ).toBe(true);
    expect(
      podeGerenciarEspecialidade(sessionWith([{ name: "gestor_unidade", unitScope: "medico" }])),
    ).toBe(true);
    expect(
      podeGerenciarEspecialidade(sessionWith([{ name: "recepcao", unitScope: "medico" }])),
    ).toBe(false);
  });
});
