"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { podeEncaminhar } from "@/lib/medico/rbac";
import { criarEncaminhamento } from "@/lib/medico/encaminhamento";
import { logEvent } from "@/lib/audit";

export async function criarEncaminhamentoAction(formData: FormData) {
  const session = await auth();
  if (!canAccessUnidade(session, "medico")) throw new Error("Sem permissão");
  if (!podeEncaminhar(session)) throw new Error("Sem permissão");

  const consultaOrigemId = String(formData.get("consultaOrigemId"));
  const cidadaoId = String(formData.get("cidadaoId"));
  const especialidadeId = String(formData.get("especialidadeId"));
  const motivo = String(formData.get("motivo") ?? "").trim() || undefined;

  const enc = await criarEncaminhamento({
    cidadaoId,
    consultaOrigemId,
    especialidadeId,
    motivo,
    createdBy: session!.user.id,
  });
  await logEvent({
    userId: session!.user.id,
    action: "encaminhamento_criado",
    entityType: "encaminhamento",
    entityId: enc.id,
    rootEntityType: "cidadao",
    rootEntityId: cidadaoId,
    meta: { especialidadeId, consultaOrigemId },
  });
  revalidatePath(`/medico/consultas/${consultaOrigemId}`);
}
