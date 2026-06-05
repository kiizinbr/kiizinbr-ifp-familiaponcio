"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canAccessUnidade } from "@/lib/rbac";
import { gerarSlots, bloquearSlot, liberarSlot } from "@/lib/medico/agenda";
import { criarTemplateSchema } from "@/lib/medico/agenda-schema";
import { podeConfigurarAgendaProfissional } from "@/lib/medico/rbac";
import { logEvent } from "@/lib/audit";

const DIAS_90 = 90 * 86_400_000;

export async function criarTemplateAction(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Sem sessão");
  if (!canAccessUnidade(session, "medico")) throw new Error("Sem permissão");

  const prof = await db.profissional.findUnique({ where: { userId: session.user.id } });
  if (!prof) throw new Error("Profissional não encontrado");
  if (!podeConfigurarAgendaProfissional(session, prof.userId)) throw new Error("Sem permissão");

  const parsed = criarTemplateSchema.safeParse({
    diasSemana: formData.getAll("diasSemana").map((v) => Number(v)),
    faixaInicio: String(formData.get("faixaInicio") ?? ""),
    faixaFim: String(formData.get("faixaFim") ?? ""),
    duracaoSlotMin: Number(formData.get("duracaoSlotMin")),
    especialidadeId: String(formData.get("especialidadeId") ?? ""),
    validoDe: String(formData.get("validoDe") ?? ""),
    validoAte: String(formData.get("validoAte") ?? ""),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados do template inválidos");
  }
  const { diasSemana, faixaInicio, faixaFim, duracaoSlotMin, especialidadeId } = parsed.data;
  const validoDe = new Date(parsed.data.validoDe);
  const validoAte = parsed.data.validoAte
    ? new Date(parsed.data.validoAte)
    : new Date(validoDe.getTime() + DIAS_90);

  const template = await db.agendaTemplate.create({
    data: {
      profissionalId: prof.id,
      especialidadeId,
      diasSemana,
      faixaInicio,
      faixaFim,
      duracaoSlotMin,
      validoDe,
      validoAte,
      ativo: true,
    },
  });

  const slots = gerarSlots({
    profissionalId: prof.id,
    especialidadeId,
    diasSemana,
    faixaInicio,
    faixaFim,
    duracaoSlotMin,
    validoDe,
    validoAte,
  });

  // createMany idempotente: a unique [profissionalId, dataHoraInicio] ignora
  // slots já existentes no mesmo horário (skipDuplicates), numa única query em
  // vez de um round-trip por slot (~720 num template de 90 dias).
  await db.slot.createMany({
    data: slots.map((s) => ({
      profissionalId: prof.id,
      especialidadeId,
      templateId: template.id,
      dataHoraInicio: s.dataHoraInicio,
      duracaoMin: duracaoSlotMin,
      status: "disponivel" as const,
    })),
    skipDuplicates: true,
  });

  await logEvent({
    userId: session.user.id,
    action: "template_criado",
    meta: { templateId: template.id, slotsCount: slots.length },
  });
  revalidatePath("/medico/minha-agenda");
}

export async function bloquearSlotAction(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Sem sessão");
  if (!canAccessUnidade(session, "medico")) throw new Error("Sem permissão");
  const slotId = String(formData.get("slotId"));
  const motivo = String(formData.get("motivo") ?? "").trim() || "Bloqueado";

  const slot = await db.slot.findUniqueOrThrow({
    where: { id: slotId },
    include: { profissional: true },
  });
  if (!podeConfigurarAgendaProfissional(session, slot.profissional.userId)) {
    throw new Error("Sem permissão");
  }

  await bloquearSlot(slotId, motivo);
  await logEvent({ userId: session.user.id, action: "slot_bloqueado", meta: { slotId, motivo } });
  revalidatePath("/medico/minha-agenda");
}

export async function desbloquearSlotAction(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Sem sessão");
  if (!canAccessUnidade(session, "medico")) throw new Error("Sem permissão");
  const slotId = String(formData.get("slotId"));

  const slot = await db.slot.findUniqueOrThrow({
    where: { id: slotId },
    include: { profissional: true },
  });
  if (!podeConfigurarAgendaProfissional(session, slot.profissional.userId)) {
    throw new Error("Sem permissão");
  }

  await liberarSlot(slotId, "Desbloqueado pelo profissional");
  await logEvent({ userId: session.user.id, action: "slot_desbloqueado", meta: { slotId } });
  revalidatePath("/medico/minha-agenda");
}
