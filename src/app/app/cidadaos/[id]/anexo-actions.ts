"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/audit";
import { can, hasAnyRole } from "@/lib/rbac";
import {
  getCidadaoAnexoUploadUrl,
  isAllowedMimeType,
  MAX_FILE_SIZE_BYTES,
  MAX_TOTAL_SIZE_PER_CIDADAO_BYTES,
  removeCidadaoAnexo,
  statCidadaoAnexo,
} from "@/lib/minio";
import type { UnitScope } from "@/lib/rbac-types";

export type AnexoActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

async function checkCidadaoEditPermission(cidadaoId: string) {
  const session = await auth();
  if (!session) return { error: "Sessão expirada", session: null, cidadao: null };

  const cidadao = await db.cidadao.findUnique({
    where: { id: cidadaoId },
    select: { id: true, unitIdOrigem: true, nomeCompleto: true },
  });
  if (!cidadao) return { error: "Cidadão não encontrado", session, cidadao: null };

  const allowed = can(session, "edit", "ficha_cidada", {
    unitScope: cidadao.unitIdOrigem as UnitScope,
  });
  if (!allowed) return { error: "Sem permissão para anexar arquivos", session, cidadao: null };

  return { error: null, session, cidadao };
}

/**
 * Passo 1 do upload: client pede URL presigned, server valida + retorna URL temporária.
 * Não cria row ainda — só depois de confirmAnexoUpload.
 */
export async function requestAnexoUploadUrl(args: {
  cidadaoId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<AnexoActionResult<{ uploadUrl: string; storageKey: string }>> {
  const check = await checkCidadaoEditPermission(args.cidadaoId);
  if (check.error || !check.cidadao) {
    return { ok: false, error: check.error ?? "Erro desconhecido" };
  }

  if (!isAllowedMimeType(args.mimeType)) {
    return { ok: false, error: "Tipo de arquivo não permitido. Aceitos: PDF, JPG, PNG." };
  }
  if (args.sizeBytes <= 0 || args.sizeBytes > MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      error: `Arquivo inválido ou maior que ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB.`,
    };
  }

  // Verifica total size acumulado do cidadão (§0.5)
  const totalExistente = await db.anexoCidadao.aggregate({
    where: { cidadaoId: args.cidadaoId, deletedAt: null },
    _sum: { sizeBytes: true },
  });
  const totalAtual = totalExistente._sum.sizeBytes ?? 0;
  if (totalAtual + args.sizeBytes > MAX_TOTAL_SIZE_PER_CIDADAO_BYTES) {
    return {
      ok: false,
      error: `Limite total de ${MAX_TOTAL_SIZE_PER_CIDADAO_BYTES / 1024 / 1024}MB por cidadão excedido.`,
    };
  }

  try {
    const { storageKey, uploadUrl } = await getCidadaoAnexoUploadUrl({
      cidadaoId: args.cidadaoId,
      mimeType: args.mimeType,
      sizeBytes: args.sizeBytes,
    });
    return { ok: true, data: { uploadUrl, storageKey } };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Erro ao gerar URL de upload",
    };
  }
}

/**
 * Passo 2 do upload: client confirma que terminou o PUT, server stat + cria row.
 */
export async function confirmAnexoUpload(args: {
  cidadaoId: string;
  storageKey: string;
  fileName: string;
  mimeType: string;
  descricao?: string;
}): Promise<AnexoActionResult<{ anexoId: string }>> {
  const check = await checkCidadaoEditPermission(args.cidadaoId);
  if (check.error || !check.cidadao || !check.session) {
    return { ok: false, error: check.error ?? "Erro desconhecido" };
  }

  // Confirma com MinIO que o objeto realmente está lá
  const stat = await statCidadaoAnexo(args.storageKey);
  if (!stat) {
    return { ok: false, error: "Upload não foi concluído. Tente novamente." };
  }
  if (stat.size > MAX_FILE_SIZE_BYTES) {
    // Anti-tampering — remove se cliente burlou validação client-side
    await removeCidadaoAnexo(args.storageKey).catch(() => null);
    return { ok: false, error: "Arquivo enviado é maior que o permitido." };
  }

  const anexo = await db.anexoCidadao.create({
    data: {
      cidadaoId: args.cidadaoId,
      fileName: args.fileName,
      mimeType: args.mimeType,
      sizeBytes: stat.size,
      hashSha256: "", // MVP — sem hash de conteúdo. Evolução futura.
      storageKey: args.storageKey,
      descricao: args.descricao ?? null,
      uploadedById: check.session.user.id,
    },
  });

  await logEvent({
    userId: check.session.user.id,
    action: "anexo_uploaded",
    entityType: "anexo_cidadao",
    entityId: anexo.id,
    rootEntityType: "cidadao",
    rootEntityId: args.cidadaoId,
    meta: {
      cidadaoId: args.cidadaoId,
      fileName: args.fileName,
      sizeBytes: stat.size,
    },
  });

  revalidatePath(`/app/cidadaos/${args.cidadaoId}`);
  return { ok: true, data: { anexoId: anexo.id } };
}

/**
 * Soft delete de anexo (deletedAt). Remove do MinIO também (não fica órfão).
 * Só super_admin, gestor_geral e gestor_unidade da unidade podem remover.
 */
export async function removeAnexo(anexoId: string): Promise<AnexoActionResult> {
  const session = await auth();
  if (!session) return { ok: false, error: "Sessão expirada" };

  const anexo = await db.anexoCidadao.findUnique({
    where: { id: anexoId },
    include: { cidadao: { select: { unitIdOrigem: true } } },
  });
  if (!anexo) return { ok: false, error: "Anexo não encontrado" };

  const allowedRoles = hasAnyRole(session, "super_admin", "gestor_geral", "gestor_unidade");
  if (!allowedRoles) {
    return { ok: false, error: "Sem permissão para remover anexos" };
  }

  await removeCidadaoAnexo(anexo.storageKey).catch(() => null);
  await db.anexoCidadao.update({
    where: { id: anexoId },
    data: { deletedAt: new Date() },
  });

  await logEvent({
    userId: session.user.id,
    action: "anexo_removed",
    entityType: "anexo_cidadao",
    entityId: anexoId,
    rootEntityType: "cidadao",
    rootEntityId: anexo.cidadaoId,
    meta: { removed: true, fileName: anexo.fileName },
  });

  revalidatePath(`/app/cidadaos/${anexo.cidadaoId}`);
  return { ok: true, data: undefined };
}
