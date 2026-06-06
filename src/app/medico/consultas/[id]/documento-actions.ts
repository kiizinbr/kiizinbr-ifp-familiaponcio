"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/audit";
import { canAccessUnidade } from "@/lib/rbac";
import { podeEmitirDocumento } from "@/lib/medico/rbac";

/** Lê um campo de texto do FormData, normaliza para `string | null`. */
function text(formData: FormData, key: string): string | null {
  const v = String(formData.get(key) ?? "").trim();
  return v || null;
}

/** Lê um Int não-negativo do FormData, ou `null` se vazio/ inválido. */
function intPos(formData: FormData, key: string): number | null {
  const v = String(formData.get(key) ?? "").trim();
  if (!v) return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Carrega a consulta com os dados necessários para o snapshot do documento +
 * gate de RBAC. Centraliza a auth para receita e atestado.
 */
async function carregarConsultaParaDocumento(consultaId: string) {
  const session = await auth();
  if (!session) redirect("/medico/login" as Route);
  if (!canAccessUnidade(session, "medico")) throw new Error("Sem permissão");

  const consulta = await db.consulta.findUniqueOrThrow({
    where: { id: consultaId },
    include: {
      cidadao: { select: { nomeCompleto: true, nomeSocial: true } },
      profissional: {
        select: { id: true, userId: true, nomeExibicao: true, conselho: true, nroConselho: true },
      },
    },
  });

  if (!podeEmitirDocumento(session, consulta.profissional.userId)) {
    throw new Error("Sem permissão para emitir documentos desta consulta");
  }

  return { session, consulta };
}

/**
 * Emite uma receita (receituário) para a consulta. MVP: 1 item via campos
 * medicamento/posologia/quantidade/via. Snapshots de paciente e profissional
 * congelados no momento da emissão (documento legal). logEvent + volta pra
 * consulta com ?doc=ok.
 */
export async function emitirReceitaAction(formData: FormData) {
  const consultaId = String(formData.get("consultaId"));
  const { session, consulta } = await carregarConsultaParaDocumento(consultaId);

  const medicamento = text(formData, "medicamento");
  const posologia = text(formData, "posologia");
  // Sem medicamento/posologia não há receita válida — volta com erro.
  if (!medicamento || !posologia) {
    redirect(`/medico/consultas/${consultaId}?doc=erro_receita` as Route);
  }

  const nomePaciente = consulta.cidadao.nomeSocial || consulta.cidadao.nomeCompleto;
  const receita = await db.receita.create({
    data: {
      consultaId,
      profissionalId: consulta.profissionalId,
      nomePaciente,
      nomeProfissional: consulta.profissional.nomeExibicao,
      conselho: consulta.profissional.conselho,
      nroConselho: consulta.profissional.nroConselho,
      observacoes: text(formData, "observacoes"),
      itens: {
        create: [
          {
            medicamento,
            posologia,
            quantidade: text(formData, "quantidade"),
            via: text(formData, "via"),
          },
        ],
      },
    },
  });

  await logEvent({
    userId: session.user.id,
    action: "receita_emitida",
    entityType: "receita",
    entityId: receita.id,
    rootEntityType: "cidadao",
    rootEntityId: consulta.cidadaoId,
    meta: { consultaId },
  });

  revalidatePath(`/medico/consultas/${consultaId}` as Route);
  redirect(`/medico/consultas/${consultaId}?doc=ok` as Route);
}

/**
 * Emite um atestado médico para a consulta. diasAfastamento (Int opcional),
 * cid (opcional, sigilo), observacao (opcional). Snapshots congelados.
 * logEvent + volta pra consulta com ?doc=ok.
 */
export async function emitirAtestadoAction(formData: FormData) {
  const consultaId = String(formData.get("consultaId"));
  const { session, consulta } = await carregarConsultaParaDocumento(consultaId);

  const nomePaciente = consulta.cidadao.nomeSocial || consulta.cidadao.nomeCompleto;
  const atestado = await db.atestado.create({
    data: {
      consultaId,
      profissionalId: consulta.profissionalId,
      nomePaciente,
      nomeProfissional: consulta.profissional.nomeExibicao,
      conselho: consulta.profissional.conselho,
      nroConselho: consulta.profissional.nroConselho,
      diasAfastamento: intPos(formData, "diasAfastamento"),
      cid: text(formData, "cid"),
      observacao: text(formData, "observacao"),
    },
  });

  await logEvent({
    userId: session.user.id,
    action: "atestado_emitido",
    entityType: "atestado",
    entityId: atestado.id,
    rootEntityType: "cidadao",
    rootEntityId: consulta.cidadaoId,
    meta: { consultaId },
  });

  revalidatePath(`/medico/consultas/${consultaId}` as Route);
  redirect(`/medico/consultas/${consultaId}?doc=ok` as Route);
}
