"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/audit";
import { canAccessUnidade } from "@/lib/rbac";
import { podeEmitirDocumento } from "@/lib/medico/rbac";
import { assertAcessoCidadao } from "@/lib/cidadao-authz";
import { ReceitaItensSchema, normalizarReceitaItens } from "@/lib/medico/receita";

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

  // A1 IDOR guard: confirma acesso à unidade do cidadão da consulta (consultaId
  // vem do cliente; o gate de rota não confere a unidade do OBJETO).
  await assertAcessoCidadao(session, consulta.cidadaoId, "edit");

  return { session, consulta };
}

/**
 * Emite uma receita (receituário) multi-item para a consulta. 1..N medicamentos
 * via hidden `itensJson` (validado por ReceitaItensSchema); fallback legado de 1
 * item via campos planos medicamento/posologia/quantidade/via. Snapshots de
 * paciente e profissional congelados no momento da emissão (documento legal) e os
 * N itens nascem juntos numa transação única. logEvent + volta pra consulta com
 * ?doc=ok.
 */
export async function emitirReceitaAction(formData: FormData) {
  const consultaId = String(formData.get("consultaId"));
  const { session, consulta } = await carregarConsultaParaDocumento(consultaId);

  // Itens da receita: o client receita-itens.tsx envia o hidden `itensJson`.
  // Form antigo sem o hidden (aba aberta durante o deploy) cai no caminho legado
  // com os campos planos medicamento/posologia/quantidade/via (1 item).
  const raw = formData.get("itensJson");
  let itens: {
    medicamento: string;
    posologia: string;
    quantidade: string | null;
    via: string | null;
  }[];

  if (raw != null) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(String(raw));
    } catch {
      parsed = undefined; // JSON malformado → reprovado pelo safeParse (nunca 500)
    }
    const valido = ReceitaItensSchema.safeParse(parsed);
    if (!valido.success) {
      redirect(`/medico/consultas/${consultaId}?doc=erro_receita` as Route);
    }
    itens = normalizarReceitaItens(valido.data);
  } else {
    const medicamento = text(formData, "medicamento");
    const posologia = text(formData, "posologia");
    // Sem medicamento/posologia não há receita válida — volta com erro.
    if (!medicamento || !posologia) {
      redirect(`/medico/consultas/${consultaId}?doc=erro_receita` as Route);
    }
    itens = [
      {
        medicamento,
        posologia,
        quantidade: text(formData, "quantidade"),
        via: text(formData, "via"),
      },
    ];
  }

  const nomePaciente = consulta.cidadao.nomeSocial || consulta.cidadao.nomeCompleto;
  // Atomicidade: receita.create com itens: { create: [...] } é UMA transação
  // Prisma única — receita + N itens nascem juntos ou nada nasce (snapshot
  // congelado integral). NÃO dividir em create + createMany.
  const receita = await db.receita.create({
    data: {
      consultaId,
      profissionalId: consulta.profissionalId,
      nomePaciente,
      nomeProfissional: consulta.profissional.nomeExibicao,
      conselho: consulta.profissional.conselho,
      nroConselho: consulta.profissional.nroConselho,
      observacoes: text(formData, "observacoes"),
      itens: { create: itens },
    },
  });

  await logEvent({
    userId: session.user.id,
    action: "receita_emitida",
    entityType: "receita",
    entityId: receita.id,
    rootEntityType: "cidadao",
    rootEntityId: consulta.cidadaoId,
    meta: { consultaId, qtdItens: itens.length },
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
