"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/audit";
import { podeGerirConsentimento } from "@/lib/rbac";
import { VERSAO_TERMO_TRATAMENTO, VERSAO_TERMO_IMAGEM } from "@/lib/consentimento";

async function gate() {
  const session = await auth();
  if (!podeGerirConsentimento(session)) throw new Error("Sem permissão");
  return session!;
}

/** Registra (ou re-registra) o aceite do termo de tratamento de dados (LGPD). */
export async function registrarConsentimentoTratamentoAction(formData: FormData) {
  const session = await gate();
  const cidadaoId = String(formData.get("cidadaoId"));
  await db.consentimento.upsert({
    where: { cidadaoId_tipo: { cidadaoId, tipo: "tratamento_dados" } },
    create: {
      cidadaoId,
      tipo: "tratamento_dados",
      versao: VERSAO_TERMO_TRATAMENTO,
      registradoPor: session.user.id,
    },
    update: {
      versao: VERSAO_TERMO_TRATAMENTO,
      registradoPor: session.user.id,
      registradoEm: new Date(),
      revogadoEm: null,
    },
  });
  await logEvent({
    userId: session.user.id,
    action: "consentimento_registrado",
    entityType: "consentimento",
    rootEntityType: "cidadao",
    rootEntityId: cidadaoId,
    meta: { tipo: "tratamento_dados", versao: VERSAO_TERMO_TRATAMENTO },
  });
  revalidatePath(`/app/cidadaos/${cidadaoId}`);
}

/** Revoga o consentimento de tratamento de dados. */
export async function revogarConsentimentoTratamentoAction(formData: FormData) {
  const session = await gate();
  const cidadaoId = String(formData.get("cidadaoId"));
  await db.consentimento.updateMany({
    where: { cidadaoId, tipo: "tratamento_dados", revogadoEm: null },
    data: { revogadoEm: new Date() },
  });
  await logEvent({
    userId: session.user.id,
    action: "consentimento_revogado",
    entityType: "consentimento",
    rootEntityType: "cidadao",
    rootEntityId: cidadaoId,
    meta: { tipo: "tratamento_dados" },
  });
  revalidatePath(`/app/cidadaos/${cidadaoId}`);
}

/** Registra o consentimento de uso de imagem com escopos granulares (interno/redes/imprensa). */
export async function registrarConsentimentoImagemAction(formData: FormData) {
  const session = await gate();
  const cidadaoId = String(formData.get("cidadaoId"));
  const interno = formData.has("interno");
  const redes = formData.has("redes");
  const imprensa = formData.has("imprensa");
  await db.consentimento.upsert({
    where: { cidadaoId_tipo: { cidadaoId, tipo: "imagem" } },
    create: {
      cidadaoId,
      tipo: "imagem",
      versao: VERSAO_TERMO_IMAGEM,
      registradoPor: session.user.id,
      imagemInterno: interno,
      imagemRedes: redes,
      imagemImprensa: imprensa,
    },
    update: {
      versao: VERSAO_TERMO_IMAGEM,
      registradoPor: session.user.id,
      registradoEm: new Date(),
      revogadoEm: null,
      imagemInterno: interno,
      imagemRedes: redes,
      imagemImprensa: imprensa,
    },
  });
  await logEvent({
    userId: session.user.id,
    action: "consentimento_registrado",
    entityType: "consentimento",
    rootEntityType: "cidadao",
    rootEntityId: cidadaoId,
    meta: { tipo: "imagem", interno, redes, imprensa },
  });
  revalidatePath(`/app/cidadaos/${cidadaoId}`);
}
