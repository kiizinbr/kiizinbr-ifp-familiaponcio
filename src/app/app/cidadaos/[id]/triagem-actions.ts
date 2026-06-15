"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/audit";
import { deveAtivarCidadao, podeFazerTriagem } from "@/lib/triagem";
import {
  assertAcessoCidadao,
  SemAcessoCidadaoError,
  CidadaoNaoEncontradoError,
} from "@/lib/cidadao-authz";

export type TriagemActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

const UNIDADES = ["medico", "capacitacao", "esportivo", "recreativo"] as const;
const STATUS_ELEG = ["pendente", "aprovado", "negado", "encaminhado"] as const;
type StatusEleg = (typeof STATUS_ELEG)[number];

/** Abre uma triagem para o cidadão (reusa a aberta existente, se houver). */
export async function abrirTriagem(
  cidadaoId: string,
): Promise<TriagemActionResult<{ triagemId: string }>> {
  const session = await auth();
  if (!session || !podeFazerTriagem(session)) {
    return { ok: false, error: "Sem permissão para abrir triagem" };
  }

  // IDOR guard: o cidadaoId vem do cliente; exige acesso à unidade do cidadão.
  // assertAcessoCidadao já faz o findUnique (existência + unidade), substituindo a
  // query anterior. social/super_admin (podeFazerTriagem) passam cross-unidade —
  // can("edit","ficha_cidada") os autoriza globalmente (rbac.ts:63,70-72).
  try {
    await assertAcessoCidadao(session, cidadaoId, "edit");
  } catch (e) {
    if (e instanceof CidadaoNaoEncontradoError)
      return { ok: false, error: "Cidadão não encontrado" };
    if (e instanceof SemAcessoCidadaoError)
      return { ok: false, error: "Sem permissão para esta unidade" };
    throw e;
  }

  const existente = await db.triagem.findFirst({
    where: { cidadaoId, status: "aberta" },
    orderBy: { createdAt: "desc" },
  });
  if (existente) return { ok: true, data: { triagemId: existente.id } };

  const triagem = await db.triagem.create({
    data: { cidadaoId, assistenteSocialId: session.user.id, status: "aberta" },
  });

  await logEvent({
    userId: session.user.id,
    action: "triagem_aberta",
    entityType: "triagem",
    entityId: triagem.id,
    rootEntityType: "cidadao",
    rootEntityId: cidadaoId,
  });

  revalidatePath(`/app/cidadaos/${cidadaoId}`);
  return { ok: true, data: { triagemId: triagem.id } };
}

/** Salva os dados da entrevista (parecer + observações + data). Só em triagem aberta. */
export async function salvarEntrevista(
  triagemId: string,
  input: { dataEntrevista?: string; parecer?: string; observacoes?: string },
): Promise<TriagemActionResult> {
  const session = await auth();
  if (!session || !podeFazerTriagem(session)) return { ok: false, error: "Sem permissão" };

  const triagem = await db.triagem.findUnique({
    where: { id: triagemId },
    select: { cidadaoId: true, status: true },
  });
  if (!triagem) return { ok: false, error: "Triagem não encontrada" };
  // IDOR guard: cidadaoId vem da triagem; exige acesso à unidade do cidadão.
  try {
    await assertAcessoCidadao(session, triagem.cidadaoId, "edit");
  } catch (e) {
    if (e instanceof SemAcessoCidadaoError || e instanceof CidadaoNaoEncontradoError)
      return { ok: false, error: "Sem permissão para esta unidade" };
    throw e;
  }
  if (triagem.status === "concluida") return { ok: false, error: "Triagem já concluída" };

  await db.triagem.update({
    where: { id: triagemId },
    data: {
      dataEntrevista: input.dataEntrevista ? new Date(input.dataEntrevista) : null,
      parecer: input.parecer?.trim() || null,
      observacoes: input.observacoes?.trim() || null,
    },
  });

  revalidatePath(`/app/cidadaos/${triagem.cidadaoId}`);
  return { ok: true, data: undefined };
}

/** Conclui a triagem (status concluida + closedAt). */
export async function concluirTriagem(triagemId: string): Promise<TriagemActionResult> {
  const session = await auth();
  if (!session || !podeFazerTriagem(session)) return { ok: false, error: "Sem permissão" };

  const triagem = await db.triagem.findUnique({
    where: { id: triagemId },
    select: { cidadaoId: true, status: true },
  });
  if (!triagem) return { ok: false, error: "Triagem não encontrada" };
  // IDOR guard: cidadaoId vem da triagem; exige acesso à unidade do cidadão.
  try {
    await assertAcessoCidadao(session, triagem.cidadaoId, "edit");
  } catch (e) {
    if (e instanceof SemAcessoCidadaoError || e instanceof CidadaoNaoEncontradoError)
      return { ok: false, error: "Sem permissão para esta unidade" };
    throw e;
  }
  if (triagem.status === "concluida") return { ok: true, data: undefined };

  await db.triagem.update({
    where: { id: triagemId },
    data: { status: "concluida", closedAt: new Date() },
  });

  await logEvent({
    userId: session.user.id,
    action: "triagem_concluida",
    entityType: "triagem",
    entityId: triagemId,
    rootEntityType: "cidadao",
    rootEntityId: triagem.cidadaoId,
  });

  revalidatePath(`/app/cidadaos/${triagem.cidadaoId}`);
  return { ok: true, data: undefined };
}

/**
 * Decide (ou redecide) a elegibilidade de uma unidade. Ao aprovar ≥1 unidade,
 * ativa o cidadão (statusCadastro = ativo).
 */
export async function decidirElegibilidade(
  triagemId: string,
  unidade: string,
  status: string,
  motivo?: string,
): Promise<TriagemActionResult> {
  const session = await auth();
  if (!session || !podeFazerTriagem(session)) return { ok: false, error: "Sem permissão" };

  if (!UNIDADES.includes(unidade as (typeof UNIDADES)[number])) {
    return { ok: false, error: "Unidade inválida" };
  }
  if (!STATUS_ELEG.includes(status as StatusEleg)) {
    return { ok: false, error: "Status inválido" };
  }

  const triagem = await db.triagem.findUnique({
    where: { id: triagemId },
    select: { cidadaoId: true },
  });
  if (!triagem) return { ok: false, error: "Triagem não encontrada" };
  // IDOR guard: cidadaoId vem da triagem; exige acesso à unidade do cidadão.
  try {
    await assertAcessoCidadao(session, triagem.cidadaoId, "edit");
  } catch (e) {
    if (e instanceof SemAcessoCidadaoError || e instanceof CidadaoNaoEncontradoError)
      return { ok: false, error: "Sem permissão para esta unidade" };
    throw e;
  }

  await db.elegibilidadeUnidade.upsert({
    where: { triagemId_unidade: { triagemId, unidade } },
    create: {
      triagemId,
      unidade,
      status: status as StatusEleg,
      motivo: motivo?.trim() || null,
      decididoPorId: session.user.id,
      decididoEm: new Date(),
    },
    update: {
      status: status as StatusEleg,
      motivo: motivo?.trim() || null,
      decididoPorId: session.user.id,
      decididoEm: new Date(),
    },
  });

  await logEvent({
    userId: session.user.id,
    action: "elegibilidade_decidida",
    entityType: "elegibilidade_unidade",
    entityId: triagemId,
    rootEntityType: "cidadao",
    rootEntityId: triagem.cidadaoId,
    meta: { unidade, status },
  });

  // Ativa o cidadão se ao menos uma unidade aprovou.
  const elegs = await db.elegibilidadeUnidade.findMany({
    where: { triagemId },
    select: { status: true },
  });
  if (deveAtivarCidadao(elegs)) {
    await db.cidadao.update({
      where: { id: triagem.cidadaoId },
      data: { statusCadastro: "ativo" },
    });
  }

  revalidatePath(`/app/cidadaos/${triagem.cidadaoId}`);
  return { ok: true, data: undefined };
}
