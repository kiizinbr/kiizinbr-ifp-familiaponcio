"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { podeMarcarConsulta } from "@/lib/medico/rbac";
import { assertAcessoCidadao } from "@/lib/cidadao-authz";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/audit";

async function gate(formData: FormData) {
  const session = await auth();
  if (!canAccessUnidade(session, "medico")) throw new Error("Sem permissão");
  if (!podeMarcarConsulta(session)) throw new Error("Sem permissão");
  const id = String(formData.get("id"));
  // A1 IDOR guard: `id` (consultaId) vem do cliente e o gate de rota/papel NÃO
  // confere a unidade do OBJETO. Carrega o cidadão da consulta e exige acesso à
  // unidade dele ANTES de qualquer escrita (espelha nova/actions + encaminhamento).
  const c = await db.consulta.findUniqueOrThrow({ where: { id }, select: { cidadaoId: true } });
  await assertAcessoCidadao(session, c.cidadaoId, "edit");
  // `voltar` permite a recepção continuar no painel em vez de ir pra consulta.
  // B11 anti open-redirect: aceita só path interno — começa com `/` e NÃO com
  // `//` nem `/\` (protocol-relative / backslash). Externo cai no default interno.
  const raw = String(formData.get("voltar") || "");
  const voltar = /^\/(?![/\\])/.test(raw) ? raw : `/medico/consultas/${id}`;
  return { session, id, voltar };
}

/** Recepção marca a chegada do paciente (check-in) — alimenta o tempo de espera na fila. */
export async function marcarCheckinAction(formData: FormData) {
  const { session, id, voltar } = await gate(formData);
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
  revalidatePath("/medico/recepcao");
  redirect(voltar as Route);
}

/** Desfaz o check-in (marcado por engano). */
export async function desfazerCheckinAction(formData: FormData) {
  const { session, id, voltar } = await gate(formData);
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
  revalidatePath("/medico/recepcao");
  redirect(voltar as Route);
}
