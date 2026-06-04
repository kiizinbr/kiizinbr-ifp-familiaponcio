import { describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import type { RoleName, UnitScope } from "@/lib/rbac-types";
import {
  podeAgendarEncaminhamento,
  podeAssinarNota,
  podeAtualizarSaudeCidadao,
  podeConfigurarAgendaProfissional,
  podeEditarNota,
  podeEncaminhar,
  podeGerenciarEspecialidade,
  podeGerenciarProfissional,
  podeMarcarConsulta,
  podeTransicionarConsulta,
  podeVerProntuario,
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

// ── F1.B.2 Prontuário ────────────────────────────────────────────────

describe("podeVerProntuario", () => {
  it("profissional vê (leitura cross-profissional §4)", () => {
    expect(podeVerProntuario(sessionWith([{ name: "profissional", unitScope: "medico" }]))).toBe(
      true,
    );
  });
  it("recepcao NÃO vê conteúdo clínico", () => {
    expect(podeVerProntuario(sessionWith([{ name: "recepcao", unitScope: "medico" }]))).toBe(false);
  });
  it("social NÃO vê conteúdo clínico", () => {
    expect(podeVerProntuario(sessionWith([{ name: "social", unitScope: null }]))).toBe(false);
  });
  it("sem sessão → false", () => {
    expect(podeVerProntuario(null)).toBe(false);
  });
});

describe("podeEditarNota", () => {
  it("profissional dono + rascunho → true", () => {
    const s = sessionWith([{ name: "profissional", unitScope: "medico" }], "user-X");
    expect(podeEditarNota(s, "user-X", "rascunho")).toBe(true);
  });
  it("profissional dono + assinada → false (imutável)", () => {
    const s = sessionWith([{ name: "profissional", unitScope: "medico" }], "user-X");
    expect(podeEditarNota(s, "user-X", "assinada")).toBe(false);
  });
  it("profissional NÃO-dono + rascunho → false (ownership)", () => {
    const s = sessionWith([{ name: "profissional", unitScope: "medico" }], "user-X");
    expect(podeEditarNota(s, "user-Y", "rascunho")).toBe(false);
  });
  it("gestor_unidade + rascunho → false (gestor não edita clínico §0.3)", () => {
    const s = sessionWith([{ name: "gestor_unidade", unitScope: "medico" }], "user-G");
    expect(podeEditarNota(s, "user-G", "rascunho")).toBe(false);
  });
});

describe("podeAssinarNota", () => {
  it("profissional dono → true", () => {
    const s = sessionWith([{ name: "profissional", unitScope: "medico" }], "user-X");
    expect(podeAssinarNota(s, "user-X")).toBe(true);
  });
  it("profissional NÃO-dono → false", () => {
    const s = sessionWith([{ name: "profissional", unitScope: "medico" }], "user-X");
    expect(podeAssinarNota(s, "user-Y")).toBe(false);
  });
  it("super_admin não-dono → false (assinatura é ato pessoal, sem bypass §0.4)", () => {
    const s = sessionWith([{ name: "super_admin", unitScope: null }], "admin-1");
    expect(podeAssinarNota(s, "user-X")).toBe(false);
  });
});

describe("podeAtualizarSaudeCidadao", () => {
  it("profissional → true (§0.7)", () => {
    expect(
      podeAtualizarSaudeCidadao(sessionWith([{ name: "profissional", unitScope: "medico" }])),
    ).toBe(true);
  });
  it("recepcao → false", () => {
    expect(
      podeAtualizarSaudeCidadao(sessionWith([{ name: "recepcao", unitScope: "medico" }])),
    ).toBe(false);
  });
  it("sem sessão → false", () => {
    expect(podeAtualizarSaudeCidadao(null)).toBe(false);
  });
});

// ── F1.B Encaminhamento ──────────────────────────────────────────────

describe("podeEncaminhar (criar/cancelar pedido)", () => {
  it("profissional pode", () => {
    expect(podeEncaminhar(sessionWith([{ name: "profissional", unitScope: "medico" }]))).toBe(true);
  });
  it("gestor_unidade pode", () => {
    expect(podeEncaminhar(sessionWith([{ name: "gestor_unidade", unitScope: "medico" }]))).toBe(
      true,
    );
  });
  it("super_admin pode", () => {
    expect(podeEncaminhar(sessionWith([{ name: "super_admin", unitScope: null }]))).toBe(true);
  });
  it("recepcao NÃO cria pedido", () => {
    expect(podeEncaminhar(sessionWith([{ name: "recepcao", unitScope: "medico" }]))).toBe(false);
  });
  it("sem sessão → false", () => {
    expect(podeEncaminhar(null)).toBe(false);
  });
});

describe("podeAgendarEncaminhamento (trabalhar a fila)", () => {
  it("recepcao (callcenter) pode", () => {
    expect(
      podeAgendarEncaminhamento(sessionWith([{ name: "recepcao", unitScope: "medico" }])),
    ).toBe(true);
  });
  it("gestor_unidade pode", () => {
    expect(
      podeAgendarEncaminhamento(sessionWith([{ name: "gestor_unidade", unitScope: "medico" }])),
    ).toBe(true);
  });
  it("super_admin pode", () => {
    expect(podeAgendarEncaminhamento(sessionWith([{ name: "super_admin", unitScope: null }]))).toBe(
      true,
    );
  });
  it("profissional NÃO agenda", () => {
    expect(
      podeAgendarEncaminhamento(sessionWith([{ name: "profissional", unitScope: "medico" }])),
    ).toBe(false);
  });
  it("sem sessão → false", () => {
    expect(podeAgendarEncaminhamento(null)).toBe(false);
  });
});
