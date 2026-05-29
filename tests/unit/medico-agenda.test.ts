import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  gerarSlots,
  reservarSlot,
  SlotIndisponivelError,
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
