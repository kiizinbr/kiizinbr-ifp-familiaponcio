"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import type { StatusConsulta } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canAccessUnidade } from "@/lib/rbac";
import { assertAcessoCidadao } from "@/lib/cidadao-authz";
import { transicionarConsulta, liberarSlot } from "@/lib/medico/agenda";
import { podeTransicionarConsulta } from "@/lib/medico/rbac";
import { logEvent } from "@/lib/audit";
import type { AuditAction } from "@/lib/audit";

const ACTION_MAP: Record<Exclude<StatusConsulta, "agendada" | "cancelada">, AuditAction> = {
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

  // `para` pode chegar como agendada/cancelada (fora do Exclude) → action undefined;
  // o guard evita logar undefined. As 4 entradas do map são AuditAction válidas.
  const action = ACTION_MAP[para as keyof typeof ACTION_MAP];
  if (action) {
    await logEvent({ userId: session.user.id, action, meta: { consultaId: id } });
  }
  revalidatePath(`/medico/consultas/${id}`);

  // #12 — "Iniciar" das telas de FILA (minha-fila/agenda-dia) leva direto ao
  // prontuário. Redirect CONDICIONAL a DOIS gatilhos (opt-in): (1) está
  // INICIANDO o atendimento e (2) o form enviou o hidden `irParaProntuario=1`.
  // O "Iniciar" da PRÓPRIA tela de detalhe NÃO envia o hidden (o médico já está
  // no prontuário) e Confirmar/Marcar falta nunca usam em_atendimento → todos
  // mantêm o comportamento atual (só revalidate). Vem por ÚLTIMO, após a
  // transição + audit + revalidate (redirect lança internamente no Next).
  // Propaga ?voltar (mesmo guard anti-open-redirect da checkin-action) pro
  // "← Voltar" no topo do prontuário cair na fila de origem.
  if (para === "em_atendimento" && String(formData.get("irParaProntuario")) === "1") {
    const rawVoltar = String(formData.get("voltar") || "");
    const voltar = /^\/(?![/\\])/.test(rawVoltar) ? rawVoltar : null;
    const destino = voltar
      ? `/medico/consultas/${id}?voltar=${encodeURIComponent(voltar)}`
      : `/medico/consultas/${id}`;
    redirect(destino as Route);
  }
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
