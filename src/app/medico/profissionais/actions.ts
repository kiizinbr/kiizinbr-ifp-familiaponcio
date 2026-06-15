"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Route } from "next";
import { z } from "zod";
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

/** Lista de ids de especialidade enviada pelo form (≥1 id não-vazio). */
const EspIdsSchema = z.array(z.string().min(1)).min(1, "Selecione ao menos 1 especialidade");

/**
 * F6 — valida ids de especialidade contra existência + `ativa:true` antes do
 * connect (evita FK 500 e vínculo a especialidade inativa). Só deve ser chamada
 * quando há ids a validar (lista vazia no update = "limpar tudo", tratada à parte).
 */
async function assertEspecialidadesValidas(espIds: string[]): Promise<void> {
  const parsed = EspIdsSchema.safeParse(espIds);
  if (!parsed.success) throw new Error("Especialidade inválida");
  const ativas = await db.especialidade.findMany({
    where: { id: { in: parsed.data }, ativa: true },
    select: { id: true },
  });
  const idsValidos = new Set(ativas.map((e) => e.id));
  const invalidos = parsed.data.filter((id) => !idsValidos.has(id));
  if (invalidos.length > 0) throw new Error("Especialidade inexistente ou inativa");
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

  // M4 — valida o USUÁRIO-ALVO antes do create (espelha vincularLoginInstrutorAction):
  // (1) existe, (2) tem papel profissional@medico, (3) não está já vinculado a um
  // Profissional. Backing de DB: Profissional.userId @unique (schema:496); a checagem
  // em código dá erro amigável em vez de P2002/P2003 cru.
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { userRoles: { include: { role: true } } },
  });
  if (!user) throw new Error("Usuário-alvo não encontrado");
  const temPapel = user.userRoles.some(
    (ur) => ur.role.name === "profissional" && ur.unitScope === "medico",
  );
  if (!temPapel) throw new Error("O usuário não tem papel de profissional no Centro Médico");
  const jaProfissional = await db.profissional.findUnique({ where: { userId } });
  if (jaProfissional) throw new Error("Este usuário já está vinculado a um profissional");

  // F6 — especialidades existem e estão ativas (≥1 já garantido acima).
  await assertEspecialidadesValidas(espIds);

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
      // F6 — valida o que ENTRA antes do connect; lista vazia = limpar tudo
      // (deleteMany sem createMany), sem aplicar a validação min(1).
      if (espIds.length > 0) await assertEspecialidadesValidas(espIds);
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
