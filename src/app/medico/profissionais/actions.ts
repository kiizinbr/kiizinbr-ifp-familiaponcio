"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canAccessUnidade } from "@/lib/rbac";
import { camposEditaveisProfissional, podeGerenciarProfissional } from "@/lib/medico/rbac";
import { logEvent } from "@/lib/audit";

function parseEspecialidades(formData: FormData): string[] {
  return formData
    .getAll("especialidadeIds")
    .map((v) => String(v))
    .filter(Boolean);
}

export async function criarProfissionalAction(formData: FormData) {
  const session = await auth();
  if (!canAccessUnidade(session, "medico")) throw new Error("Sem permissão");
  if (!podeGerenciarProfissional(session)) throw new Error("Sem permissão");

  const userId = String(formData.get("userId") ?? "");
  const nomeExibicao = String(formData.get("nomeExibicao") ?? "").trim();
  const conselho = String(formData.get("conselho") ?? "").trim();
  const nroConselho = String(formData.get("nroConselho") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim() || null;
  const espIds = parseEspecialidades(formData);

  if (!userId || !nomeExibicao || !conselho || !nroConselho) {
    throw new Error("Campos obrigatórios ausentes");
  }
  if (espIds.length === 0) throw new Error("Selecione ao menos 1 especialidade");

  const prof = await db.profissional.create({
    data: {
      userId,
      nomeExibicao,
      conselho,
      nroConselho,
      bio,
      ativo: true,
      especialidades: { create: espIds.map((eid) => ({ especialidadeId: eid })) },
    },
  });
  await logEvent({
    userId: session!.user.id,
    action: "profissional_cadastrado",
    meta: { profissionalId: prof.id, nomeExibicao },
  });
  redirect(`/medico/profissionais/${prof.id}` as Route);
}

export async function atualizarProfissionalAction(formData: FormData) {
  const session = await auth();
  if (!canAccessUnidade(session, "medico")) throw new Error("Sem permissão");
  const id = String(formData.get("id") ?? "");
  const prof = await db.profissional.findUniqueOrThrow({ where: { id } });
  const ehProprio = session?.user.id === prof.userId;
  if (!podeGerenciarProfissional(session) && !ehProprio) throw new Error("Sem permissão");

  const nomeExibicao = String(formData.get("nomeExibicao") ?? "").trim();
  const conselho = String(formData.get("conselho") ?? "").trim();
  const nroConselho = String(formData.get("nroConselho") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim() || null;
  const espIds = parseEspecialidades(formData);

  // M5 — allowlist por ramo: o profissional NÃO-gestor edita só nomeExibicao+bio.
  // CRM (conselho/nroConselho) e especialidades só pela gestão — o dono não
  // reescreve o próprio CRM (que documento-actions congela em receita/atestado, A2).
  const campos = camposEditaveisProfissional(session, ehProprio);
  const podeCrm = campos.includes("conselho"); // conselho+nroConselho andam juntos
  const podeEspecialidades = campos.includes("especialidades");

  await db.$transaction(async (tx) => {
    await tx.profissional.update({
      where: { id },
      // conselho/nroConselho só quando o ramo permite — senão preserva o valor do banco.
      data: podeCrm ? { nomeExibicao, conselho, nroConselho, bio } : { nomeExibicao, bio },
    });
    if (podeEspecialidades) {
      await tx.profissionalEspecialidade.deleteMany({ where: { profissionalId: id } });
      if (espIds.length > 0) {
        await tx.profissionalEspecialidade.createMany({
          data: espIds.map((eid) => ({ profissionalId: id, especialidadeId: eid })),
        });
      }
    }
  });
  await logEvent({
    userId: session!.user.id,
    action: "profissional_atualizado",
    meta: { profissionalId: id },
  });
  revalidatePath(`/medico/profissionais/${id}`);
  redirect(`/medico/profissionais/${id}` as Route);
}

export async function toggleProfissionalAction(formData: FormData) {
  const session = await auth();
  if (!canAccessUnidade(session, "medico")) throw new Error("Sem permissão");
  if (!podeGerenciarProfissional(session)) throw new Error("Sem permissão");
  const id = String(formData.get("id") ?? "");
  const prof = await db.profissional.findUniqueOrThrow({ where: { id } });
  await db.profissional.update({ where: { id }, data: { ativo: !prof.ativo } });
  await logEvent({
    userId: session!.user.id,
    action: "profissional_desativado",
    meta: { profissionalId: id, ativo: !prof.ativo },
  });
  revalidatePath(`/medico/profissionais/${id}`);
}
