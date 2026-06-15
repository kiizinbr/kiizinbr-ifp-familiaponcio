"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade, podeGerirPainel } from "@/lib/rbac";
import { db } from "@/lib/db";
import { extrairYoutubeId } from "@/lib/painel/core";

async function gate(unidade: string) {
  const session = await auth();
  if (!session || !canAccessUnidade(session, unidade) || !podeGerirPainel(session)) {
    throw new Error("Sem permissao");
  }
  return session;
}

export async function salvarVideoAction(formData: FormData): Promise<void> {
  const unidade = String(formData.get("unidade"));
  await gate(unidade);
  const videoUrl = String(formData.get("videoUrl") || "").trim() || null;
  // Vazio/null = limpar o video (permitido). Se preenchido, exige URL de YouTube valida
  // (mesma regex do player) — senao o player cairia no fallback "IFP" sem aviso ao gestor.
  if (videoUrl && !extrairYoutubeId(videoUrl)) {
    redirect(`/painel/${unidade}/config?video=erro` as Route);
  }
  await db.painelConfig.upsert({
    where: { unidade },
    create: { unidade, videoUrl },
    update: { videoUrl },
  });
  revalidatePath(`/painel/${unidade}/config`);
}

export async function adicionarAnuncioAction(formData: FormData): Promise<void> {
  const unidade = String(formData.get("unidade"));
  await gate(unidade);
  const texto = String(formData.get("texto") || "").trim();
  if (!texto) return;
  const ativoAteRaw = String(formData.get("ativoAte") || "").trim();
  await db.painelAnuncio.create({
    data: { unidade, texto, ativoAte: ativoAteRaw ? new Date(ativoAteRaw) : null },
  });
  revalidatePath(`/painel/${unidade}/config`);
}

export async function removerAnuncioAction(formData: FormData): Promise<void> {
  const unidade = String(formData.get("unidade"));
  await gate(unidade);
  const id = String(formData.get("id"));
  await db.painelAnuncio.deleteMany({ where: { id, unidade } });
  revalidatePath(`/painel/${unidade}/config`);
}
