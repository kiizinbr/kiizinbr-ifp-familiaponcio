"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { podeEncaminhar } from "@/lib/medico/rbac";
import { cancelarEncaminhamento } from "@/lib/medico/encaminhamento";
import { logEvent } from "@/lib/audit";

export async function cancelarEncaminhamentoAction(formData: FormData) {
  const session = await auth();
  if (!canAccessUnidade(session, "medico")) throw new Error("Sem permissão");
  if (!podeEncaminhar(session)) throw new Error("Sem permissão");

  const id = String(formData.get("encaminhamentoId"));
  const motivo = String(formData.get("motivo") ?? "").trim() || undefined;
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
