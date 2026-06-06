"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { podeMarcarConsulta } from "@/lib/medico/rbac";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/audit";

async function gate(formData: FormData) {
  const session = await auth();
  if (!canAccessUnidade(session, "medico")) throw new Error("Sem permissão");
  if (!podeMarcarConsulta(session)) throw new Error("Sem permissão");
  return { session, id: String(formData.get("id")) };
}

/** Recepção marca a chegada do paciente (check-in) — alimenta o tempo de espera na fila. */
export async function marcarCheckinAction(formData: FormData) {
  const { session, id } = await gate(formData);
  await db.consulta.update({ where: { id }, data: { checkinEm: new Date() } });
  await logEvent({
    userId: session!.user.id,
    action: "consulta_checkin",
    entityType: "consulta",
    entityId: id,
    meta: { checkin: true },
  });
  revalidatePath(`/medico/consultas/${id}`);
  revalidatePath("/medico");
  redirect(`/medico/consultas/${id}` as Route);
}

/** Desfaz o check-in (marcado por engano). */
export async function desfazerCheckinAction(formData: FormData) {
  const { session, id } = await gate(formData);
  await db.consulta.update({ where: { id }, data: { checkinEm: null } });
  await logEvent({
    userId: session!.user.id,
    action: "consulta_checkin",
    entityType: "consulta",
    entityId: id,
    meta: { checkin: false },
  });
  revalidatePath(`/medico/consultas/${id}`);
  revalidatePath("/medico");
  redirect(`/medico/consultas/${id}` as Route);
}
