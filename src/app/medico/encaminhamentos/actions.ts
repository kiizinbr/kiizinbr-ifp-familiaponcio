"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { db } from "@/lib/db";
import { podeEncaminhar, podeAgendarEncaminhamento } from "@/lib/medico/rbac";
import { assertAcessoCidadao } from "@/lib/cidadao-authz";
import { cancelarEncaminhamento } from "@/lib/medico/encaminhamento";
import { reservarSlot, SlotIndisponivelError } from "@/lib/medico/agenda";
import { logEvent } from "@/lib/audit";

export async function cancelarEncaminhamentoAction(formData: FormData) {
  const session = await auth();
  if (!canAccessUnidade(session, "medico")) throw new Error("Sem permissão");
  if (!podeEncaminhar(session)) throw new Error("Sem permissão");

  const id = String(formData.get("encaminhamentoId"));
  const motivo = String(formData.get("motivo") ?? "").trim() || undefined;

  // A1 IDOR guard: encaminhamentoId vem do cliente; carrega o enc e exige acesso
  // à unidade do cidadão dele antes de cancelar.
  const enc = await db.encaminhamento.findUnique({
    where: { id },
    select: { cidadaoId: true },
  });
  if (!enc) throw new Error("Encaminhamento não encontrado");
  await assertAcessoCidadao(session, enc.cidadaoId, "edit");

  await cancelarEncaminhamento(id, motivo);
  await logEvent({
    userId: session!.user.id,
    action: "encaminhamento_cancelado",
    entityType: "encaminhamento",
    entityId: id,
    meta: { motivo },
  });
  revalidatePath("/medico/encaminhamentos");
}

/**
 * Encaixe: agenda o encaminhamento no PRÓXIMO slot disponível da sua especialidade
 * em 1 clique (reusa reservarSlot anti-overbooking + agendarEncaminhamento). Recepção/gestão.
 */
export async function encaixarEncaminhamentoAction(formData: FormData) {
  const session = await auth();
  if (!canAccessUnidade(session, "medico")) throw new Error("Sem permissão");
  if (!podeAgendarEncaminhamento(session)) throw new Error("Sem permissão");

  const encaminhamentoId = String(formData.get("encaminhamentoId"));
  const enc = await db.encaminhamento.findUnique({ where: { id: encaminhamentoId } });
  if (!enc || enc.status !== "aguardando_agendamento") {
    redirect("/medico/encaminhamentos?erro=encaixe" as Route);
  }

  // A1 IDOR guard: exige acesso à unidade do cidadão do encaminhamento antes de
  // reservar o slot e marcar a consulta.
  await assertAcessoCidadao(session, enc.cidadaoId, "edit");

  const slot = await db.slot.findFirst({
    where: {
      especialidadeId: enc.especialidadeId,
      status: "disponivel",
      dataHoraInicio: { gte: new Date() },
    },
    orderBy: { dataHoraInicio: "asc" },
  });
  if (!slot) {
    redirect("/medico/encaminhamentos?erro=sem_slot" as Route);
  }

  try {
    const consulta = await reservarSlot({
      slotId: slot.id,
      cidadaoId: enc.cidadaoId,
      profissionalId: slot.profissionalId,
      especialidadeId: enc.especialidadeId,
      createdBy: session!.user.id,
      origemEncaminhamentoId: encaminhamentoId,
    });
    await logEvent({
      userId: session!.user.id,
      action: "consulta_agendada",
      entityType: "consulta",
      entityId: consulta.id,
      meta: { encaixe: true, encaminhamentoId },
    });
    await logEvent({
      userId: session!.user.id,
      action: "encaminhamento_agendado",
      entityType: "encaminhamento",
      entityId: encaminhamentoId,
      meta: { consultaId: consulta.id },
    });
    revalidatePath("/medico/encaminhamentos");
    redirect(`/medico/consultas/${consulta.id}?encaixe=ok` as Route);
  } catch (e) {
    if (e instanceof SlotIndisponivelError) {
      redirect("/medico/encaminhamentos?erro=encaixe_corrida" as Route);
    }
    throw e;
  }
}
