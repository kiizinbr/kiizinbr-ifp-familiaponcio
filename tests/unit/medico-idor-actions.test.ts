import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";
import type { RoleAssignment } from "@/lib/rbac-types";

/**
 * A1 — IDOR multi-tenant nas Server Actions do /medico.
 *
 * Cada action que recebe cidadaoId/encaminhamentoId do cliente deve plugar
 * `assertAcessoCidadao` (guard de OBJETO) ANTES de qualquer escrita. Os testes
 * provam OS DOIS lados (regra dura da sprint):
 *   (a) BLOQUEIO: cidadão de OUTRA unidade → SemAcessoCidadaoError e o efeito
 *       (reservarSlot/criarEncaminhamento/…) NÃO é chamado;
 *   (b) ACESSO LEGÍTIMO: cidadão da PRÓPRIA unidade (ou social cross-unit, ou
 *       super_admin global) → a action prossegue até o efeito.
 *
 * `@/lib/rbac`, `@/lib/cidadao-authz` e `@/lib/medico/rbac` rodam REAIS (é o que
 * estamos blindando); só `db`, `auth`, efeitos (agenda/encaminhamento), audit e
 * navegação são mockados. Molde: receita-action-mock + cidadao-authz.test.
 */

const { dbMock, authMock, agendaMock, encMock, redirectMock, logEventMock } = vi.hoisted(() => {
  const f = () => vi.fn();
  const db = {
    cidadao: { findUnique: f() },
    encaminhamento: { findUnique: f() },
    slot: { findFirst: f() },
    consulta: { findUnique: f(), findUniqueOrThrow: f() },
  };
  // redirect() do Next lança internamente; replicamos para distinguir o destino.
  const redirect = vi.fn((url: string) => {
    throw new Error(`__redirect__:${url}`);
  });
  return {
    dbMock: db,
    authMock: vi.fn(),
    agendaMock: {
      reservarSlot: vi.fn().mockResolvedValue({ id: "cons1", slotId: "s1" }),
      reservarSlotAdHoc: vi.fn().mockResolvedValue({ id: "cons1", slotId: "s1" }),
      reagendarConsulta: vi.fn().mockResolvedValue(undefined),
      transicionarConsulta: vi.fn().mockResolvedValue(undefined),
      liberarSlot: vi.fn().mockResolvedValue(undefined),
      STATUS_REAGENDAVEL: new Set(["agendada", "confirmada"]),
      SlotIndisponivelError: class SlotIndisponivelError extends Error {},
      SlotJaExisteError: class SlotJaExisteError extends Error {},
      ConsultaNaoReagendavelError: class ConsultaNaoReagendavelError extends Error {},
    },
    encMock: {
      criarEncaminhamento: vi.fn().mockResolvedValue({ id: "enc1" }),
      cancelarEncaminhamento: vi.fn().mockResolvedValue(undefined),
    },
    redirectMock: redirect,
    logEventMock: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/medico/agenda", () => agendaMock);
vi.mock("@/lib/medico/encaminhamento", () => encMock);
vi.mock("@/lib/audit", () => ({ logEvent: logEventMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import { reservarConsultaAction, criarSlotAdHocAction } from "@/app/medico/consultas/nova/actions";
import { criarEncaminhamentoAction } from "@/app/medico/consultas/[id]/encaminhamento-actions";
import {
  cancelarEncaminhamentoAction,
  encaixarEncaminhamentoAction,
} from "@/app/medico/encaminhamentos/actions";
import {
  marcarCheckinAction,
  desfazerCheckinAction,
} from "@/app/medico/consultas/[id]/checkin-action";
import { reagendarConsultaAction } from "@/app/medico/consultas/[id]/reagendar-action";
import { transitionAction, cancelAction } from "@/app/medico/consultas/[id]/actions";
import { SemAcessoCidadaoError } from "@/lib/cidadao-authz";

function sess(roles: RoleAssignment[], id = "u1"): Session {
  return {
    user: { id, roles, primaryRole: roles[0] ?? null, mustChangePassword: false },
    expires: "2099-01-01",
  } as unknown as Session;
}

const RECEPCAO_MEDICO = sess([{ name: "recepcao", unitScope: "medico" }]);
const SOCIAL = sess([{ name: "social", unitScope: null }]);
const SUPER_ADMIN = sess([{ name: "super_admin", unitScope: null }]);

const CIDADAO_MEDICO = { id: "med1", unitIdOrigem: "medico" };
const CIDADAO_OUTRA = { id: "cap1", unitIdOrigem: "capacitacao" };

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

function resetAll() {
  dbMock.cidadao.findUnique.mockReset();
  dbMock.encaminhamento.findUnique.mockReset();
  dbMock.slot.findFirst.mockReset();
  dbMock.consulta.findUnique.mockReset();
  dbMock.consulta.findUniqueOrThrow.mockReset();
  agendaMock.reservarSlot.mockClear();
  agendaMock.reservarSlotAdHoc.mockClear();
  agendaMock.reagendarConsulta.mockClear();
  agendaMock.transicionarConsulta.mockClear();
  agendaMock.liberarSlot.mockClear();
  encMock.criarEncaminhamento.mockClear();
  encMock.cancelarEncaminhamento.mockClear();
  redirectMock.mockClear();
  logEventMock.mockClear();
  authMock.mockReset();
}

const PROFISSIONAL_MEDICO = sess([{ name: "profissional", unitScope: "medico" }], "prof1");

beforeEach(resetAll);

// ── reservarConsultaAction (agendar em slot) ─────────────────────────
describe("reservarConsultaAction — IDOR", () => {
  const baseForm = {
    slotId: "s1",
    cidadaoId: "x",
    profissionalId: "p1",
    especialidadeId: "e1",
  };

  it("BLOQUEIA: recepcao:medico agendando cidadão de OUTRA unidade → SemAcessoCidadaoError, sem reservarSlot", async () => {
    authMock.mockResolvedValue(RECEPCAO_MEDICO);
    dbMock.cidadao.findUnique.mockResolvedValue(CIDADAO_OUTRA);
    await expect(
      reservarConsultaAction(fd({ ...baseForm, cidadaoId: "cap1" })),
    ).rejects.toBeInstanceOf(SemAcessoCidadaoError);
    expect(agendaMock.reservarSlot).not.toHaveBeenCalled();
  });

  it("LEGÍTIMO: recepcao:medico agendando cidadão da PRÓPRIA unidade → reservarSlot é chamado", async () => {
    authMock.mockResolvedValue(RECEPCAO_MEDICO);
    dbMock.cidadao.findUnique.mockResolvedValue(CIDADAO_MEDICO);
    // o sucesso termina em redirect(/consultas/cons1) que lança.
    await expect(reservarConsultaAction(fd({ ...baseForm, cidadaoId: "med1" }))).rejects.toThrow(
      "__redirect__:/medico/consultas/cons1",
    );
    expect(agendaMock.reservarSlot).toHaveBeenCalledTimes(1);
  });

  it("LEGÍTIMO: super_admin (global) agendando cidadão de qualquer unidade → reservarSlot é chamado", async () => {
    // super_admin passa o gate de rota do médico E é cross-unit em can() — o
    // guard 'edit' não deve barrá-lo (cobre o 'não travar visão global').
    authMock.mockResolvedValue(SUPER_ADMIN);
    dbMock.cidadao.findUnique.mockResolvedValue(CIDADAO_OUTRA);
    await expect(reservarConsultaAction(fd({ ...baseForm, cidadaoId: "cap1" }))).rejects.toThrow(
      "__redirect__:/medico/consultas/cons1",
    );
    expect(agendaMock.reservarSlot).toHaveBeenCalledTimes(1);
  });

  it("gate de rota: social NÃO entra no /medico (barrado antes do guard de objeto)", async () => {
    // social não está em rolesAceitas de 'medico' (agenda via /social). O gate de
    // rota (canAccessUnidade) barra ANTES do assertAcessoCidadao — documenta que o
    // guard 'edit' (não 'create') não é o que protege aqui; o gate de rota já o faz.
    authMock.mockResolvedValue(SOCIAL);
    dbMock.cidadao.findUnique.mockResolvedValue(CIDADAO_MEDICO);
    await expect(reservarConsultaAction(fd({ ...baseForm, cidadaoId: "med1" }))).rejects.toThrow(
      "Sem permissão",
    );
    expect(agendaMock.reservarSlot).not.toHaveBeenCalled();
  });
});

// ── criarSlotAdHocAction (encaixe) ────────────────────────────────────
describe("criarSlotAdHocAction — IDOR", () => {
  const baseForm = {
    cidadaoId: "x",
    profissionalId: "p1",
    especialidadeId: "e1",
    dataHoraInicio: "2099-01-01T10:00",
    duracaoMin: "30",
  };

  it("BLOQUEIA: cidadão de OUTRA unidade → SemAcessoCidadaoError, sem reservarSlotAdHoc", async () => {
    authMock.mockResolvedValue(RECEPCAO_MEDICO);
    dbMock.cidadao.findUnique.mockResolvedValue(CIDADAO_OUTRA);
    await expect(
      criarSlotAdHocAction(fd({ ...baseForm, cidadaoId: "cap1" })),
    ).rejects.toBeInstanceOf(SemAcessoCidadaoError);
    expect(agendaMock.reservarSlotAdHoc).not.toHaveBeenCalled();
  });

  it("LEGÍTIMO: cidadão da própria unidade → reservarSlotAdHoc é chamado", async () => {
    authMock.mockResolvedValue(RECEPCAO_MEDICO);
    dbMock.cidadao.findUnique.mockResolvedValue(CIDADAO_MEDICO);
    await expect(criarSlotAdHocAction(fd({ ...baseForm, cidadaoId: "med1" }))).rejects.toThrow(
      "__redirect__:/medico/consultas/cons1",
    );
    expect(agendaMock.reservarSlotAdHoc).toHaveBeenCalledTimes(1);
  });
});

// ── criarEncaminhamentoAction ─────────────────────────────────────────
describe("criarEncaminhamentoAction — IDOR", () => {
  const baseForm = {
    consultaOrigemId: "co1",
    cidadaoId: "x",
    especialidadeId: "e1",
  };

  it("BLOQUEIA: profissional:medico encaminhando cidadão de OUTRA unidade → SemAcessoCidadaoError, sem criarEncaminhamento", async () => {
    authMock.mockResolvedValue(sess([{ name: "profissional", unitScope: "medico" }]));
    dbMock.cidadao.findUnique.mockResolvedValue(CIDADAO_OUTRA);
    await expect(
      criarEncaminhamentoAction(fd({ ...baseForm, cidadaoId: "cap1" })),
    ).rejects.toBeInstanceOf(SemAcessoCidadaoError);
    expect(encMock.criarEncaminhamento).not.toHaveBeenCalled();
  });

  it("LEGÍTIMO: profissional:medico encaminhando cidadão da própria unidade → criarEncaminhamento é chamado", async () => {
    authMock.mockResolvedValue(sess([{ name: "profissional", unitScope: "medico" }]));
    dbMock.cidadao.findUnique.mockResolvedValue(CIDADAO_MEDICO);
    await criarEncaminhamentoAction(fd({ ...baseForm, cidadaoId: "med1" }));
    expect(encMock.criarEncaminhamento).toHaveBeenCalledTimes(1);
  });
});

// ── cancelarEncaminhamentoAction (parte de encaminhamentoId) ──────────
describe("cancelarEncaminhamentoAction — IDOR", () => {
  it("BLOQUEIA: encaminhamento de cidadão de OUTRA unidade → SemAcessoCidadaoError, sem cancelarEncaminhamento", async () => {
    authMock.mockResolvedValue(sess([{ name: "profissional", unitScope: "medico" }]));
    dbMock.encaminhamento.findUnique.mockResolvedValue({ cidadaoId: "cap1" });
    dbMock.cidadao.findUnique.mockResolvedValue(CIDADAO_OUTRA);
    await expect(
      cancelarEncaminhamentoAction(fd({ encaminhamentoId: "enc1" })),
    ).rejects.toBeInstanceOf(SemAcessoCidadaoError);
    expect(encMock.cancelarEncaminhamento).not.toHaveBeenCalled();
  });

  it("LEGÍTIMO: encaminhamento de cidadão da própria unidade → cancelarEncaminhamento é chamado", async () => {
    authMock.mockResolvedValue(sess([{ name: "profissional", unitScope: "medico" }]));
    dbMock.encaminhamento.findUnique.mockResolvedValue({ cidadaoId: "med1" });
    dbMock.cidadao.findUnique.mockResolvedValue(CIDADAO_MEDICO);
    await cancelarEncaminhamentoAction(fd({ encaminhamentoId: "enc1" }));
    expect(encMock.cancelarEncaminhamento).toHaveBeenCalledTimes(1);
  });
});

// ── encaixarEncaminhamentoAction (recepcao trabalha a fila) ───────────
describe("encaixarEncaminhamentoAction — IDOR", () => {
  it("BLOQUEIA: encaminhamento de cidadão de OUTRA unidade → SemAcessoCidadaoError, sem reservarSlot", async () => {
    authMock.mockResolvedValue(RECEPCAO_MEDICO);
    dbMock.encaminhamento.findUnique.mockResolvedValue({
      cidadaoId: "cap1",
      especialidadeId: "e1",
      status: "aguardando_agendamento",
    });
    dbMock.cidadao.findUnique.mockResolvedValue(CIDADAO_OUTRA);
    await expect(
      encaixarEncaminhamentoAction(fd({ encaminhamentoId: "enc1" })),
    ).rejects.toBeInstanceOf(SemAcessoCidadaoError);
    expect(agendaMock.reservarSlot).not.toHaveBeenCalled();
  });

  it("LEGÍTIMO: encaminhamento da própria unidade com slot disponível → reservarSlot é chamado", async () => {
    authMock.mockResolvedValue(RECEPCAO_MEDICO);
    dbMock.encaminhamento.findUnique.mockResolvedValue({
      cidadaoId: "med1",
      especialidadeId: "e1",
      status: "aguardando_agendamento",
    });
    dbMock.cidadao.findUnique.mockResolvedValue(CIDADAO_MEDICO);
    dbMock.slot.findFirst.mockResolvedValue({ id: "s1", profissionalId: "p1" });
    await expect(encaixarEncaminhamentoAction(fd({ encaminhamentoId: "enc1" }))).rejects.toThrow(
      "__redirect__:/medico/consultas/cons1?encaixe=ok",
    );
    expect(agendaMock.reservarSlot).toHaveBeenCalledTimes(1);
  });
});

// ── marcarCheckinAction / desfazerCheckinAction (consultaId do cliente) ──
describe("marcarCheckinAction — IDOR", () => {
  it("BLOQUEIA: recepcao:medico no check-in de consulta de cidadão de OUTRA unidade → SemAcessoCidadaoError, sem update", async () => {
    authMock.mockResolvedValue(RECEPCAO_MEDICO);
    dbMock.consulta.findUniqueOrThrow.mockResolvedValue({ cidadaoId: "cap1" });
    dbMock.cidadao.findUnique.mockResolvedValue(CIDADAO_OUTRA);
    const update = vi.fn();
    (dbMock.consulta as Record<string, unknown>).update = update;
    await expect(marcarCheckinAction(fd({ id: "cons1" }))).rejects.toBeInstanceOf(
      SemAcessoCidadaoError,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it("LEGÍTIMO: recepcao:medico no check-in de cidadão da PRÓPRIA unidade → update e redirect", async () => {
    authMock.mockResolvedValue(RECEPCAO_MEDICO);
    dbMock.consulta.findUniqueOrThrow.mockResolvedValue({ cidadaoId: "med1" });
    dbMock.cidadao.findUnique.mockResolvedValue(CIDADAO_MEDICO);
    const update = vi.fn().mockResolvedValue(undefined);
    (dbMock.consulta as Record<string, unknown>).update = update;
    await expect(marcarCheckinAction(fd({ id: "cons1" }))).rejects.toThrow(
      "__redirect__:/medico/consultas/cons1",
    );
    expect(update).toHaveBeenCalledTimes(1);
  });
});

describe("desfazerCheckinAction — IDOR", () => {
  it("BLOQUEIA: cidadão de OUTRA unidade → SemAcessoCidadaoError, sem update", async () => {
    authMock.mockResolvedValue(RECEPCAO_MEDICO);
    dbMock.consulta.findUniqueOrThrow.mockResolvedValue({ cidadaoId: "cap1" });
    dbMock.cidadao.findUnique.mockResolvedValue(CIDADAO_OUTRA);
    const update = vi.fn();
    (dbMock.consulta as Record<string, unknown>).update = update;
    await expect(desfazerCheckinAction(fd({ id: "cons1" }))).rejects.toBeInstanceOf(
      SemAcessoCidadaoError,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it("LEGÍTIMO: cidadão da própria unidade → update e redirect", async () => {
    authMock.mockResolvedValue(RECEPCAO_MEDICO);
    dbMock.consulta.findUniqueOrThrow.mockResolvedValue({ cidadaoId: "med1" });
    dbMock.cidadao.findUnique.mockResolvedValue(CIDADAO_MEDICO);
    const update = vi.fn().mockResolvedValue(undefined);
    (dbMock.consulta as Record<string, unknown>).update = update;
    await expect(desfazerCheckinAction(fd({ id: "cons1" }))).rejects.toThrow(
      "__redirect__:/medico/consultas/cons1",
    );
    expect(update).toHaveBeenCalledTimes(1);
  });
});

// ── reagendarConsultaAction (consultaId do cliente → move de slot) ──────
describe("reagendarConsultaAction — IDOR", () => {
  it("BLOQUEIA: recepcao:medico reagendando consulta de cidadão de OUTRA unidade → SemAcessoCidadaoError, sem reagendarConsulta", async () => {
    authMock.mockResolvedValue(RECEPCAO_MEDICO);
    dbMock.consulta.findUniqueOrThrow.mockResolvedValue({ cidadaoId: "cap1" });
    dbMock.cidadao.findUnique.mockResolvedValue(CIDADAO_OUTRA);
    await expect(
      reagendarConsultaAction(fd({ consultaId: "cons1", slotId: "s2" })),
    ).rejects.toBeInstanceOf(SemAcessoCidadaoError);
    expect(agendaMock.reagendarConsulta).not.toHaveBeenCalled();
  });

  it("LEGÍTIMO: recepcao:medico reagendando cidadão da PRÓPRIA unidade → reagendarConsulta é chamado", async () => {
    authMock.mockResolvedValue(RECEPCAO_MEDICO);
    dbMock.consulta.findUniqueOrThrow.mockResolvedValue({ cidadaoId: "med1" });
    dbMock.cidadao.findUnique.mockResolvedValue(CIDADAO_MEDICO);
    await expect(
      reagendarConsultaAction(fd({ consultaId: "cons1", slotId: "s2" })),
    ).rejects.toThrow("__redirect__:/medico/consultas/cons1?reagendada=ok");
    expect(agendaMock.reagendarConsulta).toHaveBeenCalledTimes(1);
  });
});

// ── transitionAction (consultaId do cliente → muda status) ─────────────
describe("transitionAction — IDOR", () => {
  it("BLOQUEIA: recepcao:medico transicionando consulta de cidadão de OUTRA unidade → SemAcessoCidadaoError, sem transicionarConsulta", async () => {
    authMock.mockResolvedValue(RECEPCAO_MEDICO);
    dbMock.consulta.findUniqueOrThrow.mockResolvedValue({
      cidadaoId: "cap1",
      status: "agendada",
      slotId: "s1",
      profissional: { userId: "prof1" },
    });
    dbMock.cidadao.findUnique.mockResolvedValue(CIDADAO_OUTRA);
    await expect(
      transitionAction(fd({ id: "cons1", para: "em_atendimento" })),
    ).rejects.toBeInstanceOf(SemAcessoCidadaoError);
    expect(agendaMock.transicionarConsulta).not.toHaveBeenCalled();
  });

  it("LEGÍTIMO: recepcao:medico transicionando cidadão da PRÓPRIA unidade → transicionarConsulta é chamado", async () => {
    authMock.mockResolvedValue(RECEPCAO_MEDICO);
    dbMock.consulta.findUniqueOrThrow.mockResolvedValue({
      cidadaoId: "med1",
      status: "agendada",
      slotId: "s1",
      profissional: { userId: "prof1" },
    });
    dbMock.cidadao.findUnique.mockResolvedValue(CIDADAO_MEDICO);
    await transitionAction(fd({ id: "cons1", para: "em_atendimento" }));
    expect(agendaMock.transicionarConsulta).toHaveBeenCalledTimes(1);
  });
});

// ── cancelAction (consultaId do cliente → libera slot alheio) ──────────
describe("cancelAction — IDOR", () => {
  it("BLOQUEIA: recepcao:medico cancelando consulta de cidadão de OUTRA unidade → SemAcessoCidadaoError, sem liberarSlot", async () => {
    authMock.mockResolvedValue(RECEPCAO_MEDICO);
    dbMock.consulta.findUniqueOrThrow.mockResolvedValue({
      cidadaoId: "cap1",
      status: "agendada",
      slotId: "s1",
      profissional: { userId: "prof1" },
    });
    dbMock.cidadao.findUnique.mockResolvedValue(CIDADAO_OUTRA);
    await expect(cancelAction(fd({ id: "cons1", motivo: "x" }))).rejects.toBeInstanceOf(
      SemAcessoCidadaoError,
    );
    expect(agendaMock.liberarSlot).not.toHaveBeenCalled();
  });

  it("LEGÍTIMO: recepcao:medico cancelando cidadão da PRÓPRIA unidade → liberarSlot é chamado", async () => {
    authMock.mockResolvedValue(RECEPCAO_MEDICO);
    dbMock.consulta.findUniqueOrThrow.mockResolvedValue({
      cidadaoId: "med1",
      status: "agendada",
      slotId: "s1",
      profissional: { userId: "prof1" },
    });
    dbMock.cidadao.findUnique.mockResolvedValue(CIDADAO_MEDICO);
    await cancelAction(fd({ id: "cons1", motivo: "x" }));
    expect(agendaMock.liberarSlot).toHaveBeenCalledTimes(1);
  });

  it("LEGÍTIMO: profissional:medico DONO cancelando cidadão da própria unidade → liberarSlot é chamado", async () => {
    authMock.mockResolvedValue(PROFISSIONAL_MEDICO);
    dbMock.consulta.findUniqueOrThrow.mockResolvedValue({
      cidadaoId: "med1",
      status: "agendada",
      slotId: "s1",
      profissional: { userId: "prof1" },
    });
    dbMock.cidadao.findUnique.mockResolvedValue(CIDADAO_MEDICO);
    await cancelAction(fd({ id: "cons1", motivo: "x" }));
    expect(agendaMock.liberarSlot).toHaveBeenCalledTimes(1);
  });
});
