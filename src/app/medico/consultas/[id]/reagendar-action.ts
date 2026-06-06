"use server";

import { redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { podeMarcarConsulta } from "@/lib/medico/rbac";
import {
  reagendarConsulta,
  SlotIndisponivelError,
  ConsultaNaoReagendavelError,
} from "@/lib/medico/agenda";
import { logEvent } from "@/lib/audit";

/** Reagenda a consulta para o slot escolhido (move + libera o antigo, transacional). */
export async function reagendarConsultaAction(formData: FormData) {
  const session = await auth();
  if (!canAccessUnidade(session, "medico")) throw new Error("Sem permissão");
  if (!podeMarcarConsulta(session)) throw new Error("Sem permissão");

  const consultaId = String(formData.get("consultaId"));
  const novoSlotId = String(formData.get("slotId"));

  try {
    await reagendarConsulta(consultaId, novoSlotId);
    await logEvent({
      userId: session!.user.id,
      action: "consulta_reagendada",
      entityType: "consulta",
      entityId: consultaId,
      meta: { novoSlotId },
    });
    redirect(`/medico/consultas/${consultaId}?reagendada=ok` as Route);
  } catch (e) {
    if (e instanceof SlotIndisponivelError) {
      redirect(`/medico/consultas/${consultaId}/reagendar?erro=slot_indisponivel` as Route);
    }
    if (e instanceof ConsultaNaoReagendavelError) {
      redirect(`/medico/consultas/${consultaId}?erro=nao_reagendavel` as Route);
    }
    throw e;
  }
}
