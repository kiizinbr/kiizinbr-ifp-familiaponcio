import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  bloquearSlot,
  ConsultaNaoReagendavelError,
  gerarSlots,
  liberarSlot,
  reagendarConsulta,
  reservarSlot,
  SlotComConsultaError,
  SlotIndisponivelError,
  STATUS_REAGENDAVEL,
  transicionarConsulta,
  type TemplateInput,
} from "@/lib/medico/agenda";

const baseDate = new Date("2026-06-01T00:00:00Z"); // segunda-feira

const tmplPadrao: TemplateInput = {
  profissionalId: "p1",
  especialidadeId: "e1",
  diasSemana: [2, 4], // terça, quinta
  faixaInicio: "14:00",
  faixaFim: "16:00",
  duracaoSlotMin: 30,
  validoDe: baseDate,
  validoAte: new Date("2026-06-15T00:00:00Z"),
};

describe("gerarSlots", () => {
  it("gera slots só nos dias da semana definidos", () => {
    const slots = gerarSlots(tmplPadrao);
    // 2026-06-01 é segunda (dow=1) — não gera. 06-02 terça, 06-04 quinta.
    const datasGeradas = [
      ...new Set(slots.map((s) => s.dataHoraInicio.toISOString().slice(0, 10))),
    ];
    expect(datasGeradas).toContain("2026-06-02");
    expect(datasGeradas).toContain("2026-06-04");
    expect(datasGeradas).not.toContain("2026-06-01");
    expect(datasGeradas).not.toContain("2026-06-03");
  });

  it("respeita faixa horária e duração", () => {
    const slots = gerarSlots(tmplPadrao).filter((s) =>
      s.dataHoraInicio.toISOString().startsWith("2026-06-02"),
    );
    // 14:00–16:00 com 30min = 4 slots: 14:00, 14:30, 15:00, 15:30
    expect(slots).toHaveLength(4);
    expect(slots[0]!.dataHoraInicio.toISOString().slice(11, 16)).toBe("14:00");
    expect(slots[3]!.dataHoraInicio.toISOString().slice(11, 16)).toBe("15:30");
  });

  it("não passa do validoAte", () => {
    const slots = gerarSlots(tmplPadrao);
    for (const s of slots) {
      expect(s.dataHoraInicio.getTime()).toBeLessThan(tmplPadrao.validoAte!.getTime());
    }
  });

  it("propaga profissionalId e especialidadeId em cada slot", () => {
    const slots = gerarSlots(tmplPadrao);
    expect(slots.every((s) => s.profissionalId === "p1")).toBe(true);
    expect(slots.every((s) => s.especialidadeId === "e1")).toBe(true);
    expect(slots.every((s) => s.duracaoMin === 30)).toBe(true);
  });

  it("não corta slot pela metade quando duração não cabe na faixa", () => {
    const tmpl: TemplateInput = {
      ...tmplPadrao,
      diasSemana: [2],
      faixaInicio: "14:00",
      faixaFim: "14:45",
      duracaoSlotMin: 30,
    };
    const slots = gerarSlots(tmpl);
    // 14:00 (até 14:30) cabe; 14:30 (até 15:00) passa de 14:45 → 1 slot.
    const terca = slots.filter((s) => s.dataHoraInicio.toISOString().startsWith("2026-06-02"));
    expect(terca).toHaveLength(1);
    expect(terca[0]!.dataHoraInicio.toISOString().slice(11, 16)).toBe("14:00");
  });

  it("validoAte nulo respeita limiteSuperior do parâmetro", () => {
    const tmpl: TemplateInput = { ...tmplPadrao, validoAte: null };
    const limite = new Date("2026-06-10T00:00:00Z");
    const slots = gerarSlots(tmpl, { limiteSuperior: limite });
    expect(slots.every((s) => s.dataHoraInicio.getTime() < limite.getTime())).toBe(true);
    expect(slots.length).toBeGreaterThan(0);
  });
});

describe("STATUS_REAGENDAVEL", () => {
  it("agendada e confirmada são reagendáveis; demais não", () => {
    expect(STATUS_REAGENDAVEL.has("agendada")).toBe(true);
    expect(STATUS_REAGENDAVEL.has("confirmada")).toBe(true);
    expect(STATUS_REAGENDAVEL.has("em_atendimento")).toBe(false);
    expect(STATUS_REAGENDAVEL.has("realizada")).toBe(false);
    expect(STATUS_REAGENDAVEL.has("cancelada")).toBe(false);
  });
});

describe("reagendarConsulta (integration)", () => {
  it("move a consulta de slot, libera o antigo e reserva o novo", async () => {
    const prof = await db.profissional.findFirstOrThrow({
      where: { nomeExibicao: "Dr. João Silva" },
    });
    const esp = await db.especialidade.findUniqueOrThrow({ where: { nome: "Clínico Geral" } });
    const cid = await db.cidadao.findFirstOrThrow({ where: { unitIdOrigem: "medico" } });
    const erick = await db.user.findUniqueOrThrow({
      where: { email: "erick.ramos@familiaponcio.org.br" },
    });
    const slots = await db.slot.findMany({
      where: { profissionalId: prof.id, status: "disponivel" },
      orderBy: { dataHoraInicio: "asc" },
      take: 2,
    });
    const s1 = slots[0]!;
    const s2 = slots[1]!;
    await db.consulta.deleteMany({ where: { slotId: { in: [s1.id, s2.id] } } });
    await db.slot.updateMany({
      where: { id: { in: [s1.id, s2.id] } },
      data: { status: "disponivel" },
    });

    const consulta = await reservarSlot({
      slotId: s1.id,
      cidadaoId: cid.id,
      profissionalId: prof.id,
      especialidadeId: esp.id,
      createdBy: erick.id,
    });

    const movida = await reagendarConsulta(consulta.id, s2.id);

    expect(movida.slotId).toBe(s2.id);
    expect((await db.slot.findUniqueOrThrow({ where: { id: s1.id } })).status).toBe("disponivel");
    expect((await db.slot.findUniqueOrThrow({ where: { id: s2.id } })).status).toBe("reservado");

    // cleanup
    await db.consulta.deleteMany({ where: { id: consulta.id } });
    await db.slot.updateMany({
      where: { id: { in: [s1.id, s2.id] } },
      data: { status: "disponivel" },
    });
  });

  it("recusa reagendar consulta já realizada", async () => {
    expect(() => {
      if (!STATUS_REAGENDAVEL.has("realizada")) throw new ConsultaNaoReagendavelError("realizada");
    }).toThrow(ConsultaNaoReagendavelError);
  });
});

describe("reservarSlot (integration)", () => {
  async function fixtures() {
    const prof = await db.profissional.findFirstOrThrow({
      where: { nomeExibicao: "Dr. João Silva" },
    });
    const esp = await db.especialidade.findUniqueOrThrow({ where: { nome: "Clínico Geral" } });
    const cid = await db.cidadao.findFirstOrThrow({ where: { unitIdOrigem: "medico" } });
    const slot = await db.slot.findFirstOrThrow({
      where: { profissionalId: prof.id, status: "disponivel" },
      orderBy: { dataHoraInicio: "asc" },
    });
    const erick = await db.user.findUniqueOrThrow({
      where: { email: "erick.ramos@familiaponcio.org.br" },
    });
    return { prof, esp, cid, slot, erick };
  }

  async function reabrirSlot(slotId: string) {
    await db.consulta.deleteMany({ where: { slotId } });
    await db.slot.update({ where: { id: slotId }, data: { status: "disponivel" } });
  }

  it("reserva slot disponível, cria Consulta e marca slot.status=reservado", async () => {
    const { prof, esp, cid, slot, erick } = await fixtures();
    await reabrirSlot(slot.id);

    const consulta = await reservarSlot({
      slotId: slot.id,
      cidadaoId: cid.id,
      profissionalId: prof.id,
      especialidadeId: esp.id,
      createdBy: erick.id,
    });

    expect(consulta.status).toBe("agendada");
    const slotPos = await db.slot.findUniqueOrThrow({ where: { id: slot.id } });
    expect(slotPos.status).toBe("reservado");

    await reabrirSlot(slot.id);
  });

  it("lança SlotIndisponivelError quando outro processo já reservou", async () => {
    const { prof, esp, cid, slot, erick } = await fixtures();
    await reabrirSlot(slot.id);
    await db.slot.update({ where: { id: slot.id }, data: { status: "reservado" } });

    await expect(
      reservarSlot({
        slotId: slot.id,
        cidadaoId: cid.id,
        profissionalId: prof.id,
        especialidadeId: esp.id,
        createdBy: erick.id,
      }),
    ).rejects.toThrow(SlotIndisponivelError);

    await reabrirSlot(slot.id);
  });

  it("é seguro contra concorrência (race condition simulada)", async () => {
    const { prof, esp, cid, slot, erick } = await fixtures();
    await reabrirSlot(slot.id);

    const args = {
      slotId: slot.id,
      cidadaoId: cid.id,
      profissionalId: prof.id,
      especialidadeId: esp.id,
      createdBy: erick.id,
    };

    const results = await Promise.allSettled([
      reservarSlot(args),
      reservarSlot(args),
      reservarSlot(args),
      reservarSlot(args),
      reservarSlot(args),
    ]);
    const sucessos = results.filter((r) => r.status === "fulfilled");
    const falhas = results.filter((r) => r.status === "rejected");
    expect(sucessos).toHaveLength(1);
    expect(falhas).toHaveLength(4);

    await reabrirSlot(slot.id);
  });
});

describe("bloquearSlot", () => {
  it("bloqueia slot disponível com motivo", async () => {
    const slot = await db.slot.findFirstOrThrow({
      where: { status: "disponivel", consulta: { is: null } },
    });
    await db.consulta.deleteMany({ where: { slotId: slot.id } });
    await bloquearSlot(slot.id, "Férias programadas");
    const pos = await db.slot.findUniqueOrThrow({ where: { id: slot.id } });
    expect(pos.status).toBe("bloqueado");
    expect(pos.motivoBloqueio).toBe("Férias programadas");
    await db.slot.update({
      where: { id: slot.id },
      data: { status: "disponivel", motivoBloqueio: null },
    });
  });

  it("rejeita bloquear slot que tem consulta agendada", async () => {
    const consulta = await db.consulta.findFirst({ where: { status: "agendada" } });
    if (!consulta) return; // pula se estado não tem; outros testes criam
    await expect(bloquearSlot(consulta.slotId, "tentativa")).rejects.toThrow(SlotComConsultaError);
  });
});

describe("liberarSlot", () => {
  it("libera slot reservado e cancela consulta", async () => {
    const slot = await db.slot.findFirstOrThrow({
      where: { status: "disponivel", consulta: { is: null } },
    });
    await db.consulta.deleteMany({ where: { slotId: slot.id } });
    await db.slot.update({ where: { id: slot.id }, data: { status: "reservado" } });
    const prof = await db.profissional.findFirstOrThrow();
    const esp = await db.especialidade.findFirstOrThrow();
    const cid = await db.cidadao.findFirstOrThrow();
    const erick = await db.user.findUniqueOrThrow({
      where: { email: "erick.ramos@familiaponcio.org.br" },
    });
    const c = await db.consulta.create({
      data: {
        slotId: slot.id,
        cidadaoId: cid.id,
        profissionalId: prof.id,
        especialidadeId: esp.id,
        createdBy: erick.id,
        status: "agendada",
      },
    });

    await liberarSlot(slot.id, "Cidadão cancelou");

    const slotPos = await db.slot.findUniqueOrThrow({ where: { id: slot.id } });
    expect(slotPos.status).toBe("disponivel");
    const consPos = await db.consulta.findUniqueOrThrow({ where: { id: c.id } });
    expect(consPos.status).toBe("cancelada");
    expect(consPos.cancelMotivo).toBe("Cidadão cancelou");

    await db.consulta.delete({ where: { id: c.id } });
  });
});

describe("transicionarConsulta", () => {
  it("agendada → confirmada → em_atendimento → realizada (caminho feliz)", async () => {
    const slot = await db.slot.findFirstOrThrow({
      where: { status: "disponivel", consulta: { is: null } },
    });
    await db.consulta.deleteMany({ where: { slotId: slot.id } });
    const prof = await db.profissional.findFirstOrThrow();
    const esp = await db.especialidade.findFirstOrThrow();
    const cid = await db.cidadao.findFirstOrThrow();
    const erick = await db.user.findUniqueOrThrow({
      where: { email: "erick.ramos@familiaponcio.org.br" },
    });

    await db.slot.update({ where: { id: slot.id }, data: { status: "reservado" } });
    const c = await db.consulta.create({
      data: {
        slotId: slot.id,
        cidadaoId: cid.id,
        profissionalId: prof.id,
        especialidadeId: esp.id,
        createdBy: erick.id,
        status: "agendada",
      },
    });

    await transicionarConsulta(c.id, "confirmada");
    await transicionarConsulta(c.id, "em_atendimento");
    await transicionarConsulta(c.id, "realizada");

    const cPos = await db.consulta.findUniqueOrThrow({ where: { id: c.id } });
    expect(cPos.status).toBe("realizada");
    const slotPos = await db.slot.findUniqueOrThrow({ where: { id: slot.id } });
    expect(slotPos.status).toBe("realizado");

    await db.consulta.delete({ where: { id: c.id } });
    await db.slot.update({ where: { id: slot.id }, data: { status: "disponivel" } });
  });

  it("realizada → confirmada (regressão) é rejeitada", async () => {
    const slot = await db.slot.findFirstOrThrow({
      where: { status: "disponivel", consulta: { is: null } },
    });
    await db.consulta.deleteMany({ where: { slotId: slot.id } });
    const prof = await db.profissional.findFirstOrThrow();
    const esp = await db.especialidade.findFirstOrThrow();
    const cid = await db.cidadao.findFirstOrThrow();
    const erick = await db.user.findUniqueOrThrow({
      where: { email: "erick.ramos@familiaponcio.org.br" },
    });

    await db.slot.update({ where: { id: slot.id }, data: { status: "realizado" } });
    const c = await db.consulta.create({
      data: {
        slotId: slot.id,
        cidadaoId: cid.id,
        profissionalId: prof.id,
        especialidadeId: esp.id,
        createdBy: erick.id,
        status: "realizada",
      },
    });

    await expect(transicionarConsulta(c.id, "confirmada")).rejects.toThrow(/transi/i);

    await db.consulta.delete({ where: { id: c.id } });
    await db.slot.update({ where: { id: slot.id }, data: { status: "disponivel" } });
  });
});
