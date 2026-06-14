"use server";

import { revalidatePath } from "next/cache";
import type { StatusConsulta } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canAccessUnidade } from "@/lib/rbac";
import { assertAcessoCidadao } from "@/lib/cidadao-authz";
import { transicionarConsulta, liberarSlot } from "@/lib/medico/agenda";
import { podeTransicionarConsulta } from "@/lib/medico/rbac";
import { logEvent } from "@/lib/audit";

const ACTION_MAP: Record<Exclude<StatusConsulta, "agendada" | "cancelada">, string> = {
  confirmada: "consulta_confirmada",
  em_atendimento: "consulta_iniciada",
  realizada: "consulta_realizada",
  faltou: "consulta_faltou",
};

export async function transitionAction(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Sem sessão");
  if (!canAccessUnidade(session, "medico")) throw new Error("Sem permissão");

  const id = String(formData.get("id"));
  const para = String(formData.get("para")) as StatusConsulta;

  const c = await db.consulta.findUniqueOrThrow({
    where: { id },
    include: { profissional: true },
  });
  // A1 IDOR guard: o gate de papel (podeTransicionarConsulta) não confere a
  // unidade do OBJETO — recepcao/gestor passariam por papel para consulta de
  // cidadão de outra unidade. Exige acesso à unidade do cidadão antes da escrita.
  await assertAcessoCidadao(session, c.cidadaoId, "edit");
  if (!podeTransicionarConsulta(session, c.status, para, c.profissional.userId)) {
    throw new Error("Sem permissão");
  }

  await transicionarConsulta(id, para);

  const action = ACTION_MAP[para as keyof typeof ACTION_MAP];
  if (action) {
    await logEvent({ userId: session.user.id, action: action as never, meta: { consultaId: id } });
  }
  revalidatePath(`/medico/consultas/${id}`);
}

export async function cancelAction(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Sem sessão");
  if (!canAccessUnidade(session, "medico")) throw new Error("Sem permissão");

  const id = String(formData.get("id"));
  const motivo = String(formData.get("motivo") ?? "").trim() || "Cancelada";

  const c = await db.consulta.findUniqueOrThrow({
    where: { id },
    include: { profissional: true },
  });
  // A1 IDOR guard: idem transitionAction. cancelAction ainda libera o slot
  // (mutação de agenda) — exige acesso à unidade do cidadão antes de qualquer escrita.
  await assertAcessoCidadao(session, c.cidadaoId, "edit");
  if (!podeTransicionarConsulta(session, c.status, "cancelada", c.profissional.userId)) {
    throw new Error("Sem permissão");
  }

  await liberarSlot(c.slotId, motivo);
  await logEvent({
    userId: session.user.id,
    action: "consulta_cancelada",
    meta: { consultaId: id, motivo },
  });
  revalidatePath(`/medico/consultas/${id}`);
}
