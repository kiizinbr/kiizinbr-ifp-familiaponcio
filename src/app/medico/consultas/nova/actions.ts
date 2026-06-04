"use server";

import { redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { reservarSlot, SlotIndisponivelError } from "@/lib/medico/agenda";
import { podeMarcarConsulta } from "@/lib/medico/rbac";
import { logEvent } from "@/lib/audit";

export async function reservarConsultaAction(formData: FormData) {
  const session = await auth();
  if (!canAccessUnidade(session, "medico")) throw new Error("Sem permissão");
  if (!podeMarcarConsulta(session)) throw new Error("Sem permissão");

  const slotId = String(formData.get("slotId"));
  const cidadaoId = String(formData.get("cidadaoId"));
  const profissionalId = String(formData.get("profissionalId"));
  const especialidadeId = String(formData.get("especialidadeId"));
  const observacoesAgendamento = String(formData.get("observacoes") ?? "").trim() || undefined;
  const encaminhamentoId = String(formData.get("encaminhamentoId") ?? "").trim() || undefined;

  try {
    const consulta = await reservarSlot({
      slotId,
      cidadaoId,
      profissionalId,
      especialidadeId,
      createdBy: session!.user.id,
      observacoesAgendamento,
      origemEncaminhamentoId: encaminhamentoId,
    });
    await logEvent({
      userId: session!.user.id,
      action: "consulta_agendada",
      meta: { consultaId: consulta.id, slotId, cidadaoId },
    });
    if (encaminhamentoId) {
      await logEvent({
        userId: session!.user.id,
        action: "encaminhamento_agendado",
        entityType: "encaminhamento",
        entityId: encaminhamentoId,
        meta: { consultaId: consulta.id },
      });
    }
    redirect(`/medico/consultas/${consulta.id}` as Route);
  } catch (e) {
    if (e instanceof SlotIndisponivelError) {
      const enc = encaminhamentoId ? `&encaminhamentoId=${encaminhamentoId}` : "";
      redirect(
        `/medico/consultas/nova?cidadaoId=${cidadaoId}&especialidadeId=${especialidadeId}${enc}&erro=slot_indisponivel` as Route,
      );
    }
    throw e;
  }
}
