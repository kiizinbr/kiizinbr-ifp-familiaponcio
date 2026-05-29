"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarEspecialidade } from "@/lib/medico/rbac";
import { logEvent } from "@/lib/audit";

const HEX = /^#[0-9A-Fa-f]{6}$/;

export async function criarEspecialidadeAction(formData: FormData) {
  const session = await auth();
  if (!podeGerenciarEspecialidade(session)) throw new Error("Sem permissão");

  const nome = String(formData.get("nome") ?? "").trim();
  const duracaoPadraoMin = Number(formData.get("duracaoPadraoMin") ?? 30);
  const corDestaque = String(formData.get("corDestaque") ?? "#007571");

  if (!nome) throw new Error("Nome obrigatório");
  if (!Number.isFinite(duracaoPadraoMin) || duracaoPadraoMin < 5) {
    throw new Error("Duração mínima 5 min");
  }
  if (!HEX.test(corDestaque)) throw new Error("Cor inválida (hex)");

  await db.especialidade.create({
    data: { nome, duracaoPadraoMin, corDestaque, ativa: true },
  });
  await logEvent({ userId: session!.user.id, action: "especialidade_criada", meta: { nome } });
  revalidatePath("/medico/especialidades");
}

export async function toggleEspecialidadeAction(formData: FormData) {
  const session = await auth();
  if (!podeGerenciarEspecialidade(session)) throw new Error("Sem permissão");

  const id = String(formData.get("id") ?? "");
  const e = await db.especialidade.findUniqueOrThrow({ where: { id } });
  await db.especialidade.update({ where: { id }, data: { ativa: !e.ativa } });
  await logEvent({
    userId: session!.user.id,
    action: e.ativa ? "especialidade_desativada" : "especialidade_reativada",
    meta: { id, nome: e.nome },
  });
  revalidatePath("/medico/especialidades");
}
