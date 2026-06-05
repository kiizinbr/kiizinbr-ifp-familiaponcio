"use server";

import { redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasAnyRole } from "@/lib/rbac";
import { dadosAnonimizadosCidadao, dadosAnonimizadosEndereco } from "@/lib/cidadao";
import { removeCidadaoAnexo } from "@/lib/minio";
import { logEvent } from "@/lib/audit";

/**
 * Anonimização IRREVERSÍVEL de Ficha Cidadã (LGPD — direito ao esquecimento, D1).
 * Só super_admin. Mascara PII do Cidadão + Endereços, remove os anexos do MinIO,
 * marca `anonimizadoEm` e registra o ato no audit log. Sem volta.
 */
export async function anonimizarCidadaoAction(formData: FormData) {
  const session = await auth();
  if (!hasAnyRole(session, "super_admin")) throw new Error("Sem permissão");

  const id = String(formData.get("id") ?? "");
  const cidadao = await db.cidadao.findUnique({
    where: { id },
    include: { anexos: { where: { deletedAt: null } } },
  });
  if (!cidadao) throw new Error("Ficha não encontrada");
  if (cidadao.anonimizadoEm) redirect(`/app/cidadaos/${id}` as Route);

  // 1. Remove os anexos do MinIO (I/O externo — fora da transação; best-effort).
  for (const anexo of cidadao.anexos) {
    await removeCidadaoAnexo(anexo.storageKey).catch(() => null);
  }

  // 2. Transação: anonimiza Cidadão + Endereços + soft-delete dos anexos.
  await db.$transaction(async (tx) => {
    await tx.cidadao.update({
      where: { id },
      data: { ...dadosAnonimizadosCidadao(cidadao), anonimizadoEm: new Date() },
    });
    await tx.endereco.updateMany({
      where: { cidadaoId: id },
      data: dadosAnonimizadosEndereco(),
    });
    await tx.anexoCidadao.updateMany({
      where: { cidadaoId: id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  });

  await logEvent({
    userId: session!.user.id,
    action: "cidadao_anonimizado",
    entityType: "cidadao",
    entityId: id,
    rootEntityType: "cidadao",
    rootEntityId: id,
  });

  redirect(`/app/cidadaos/${id}` as Route);
}
