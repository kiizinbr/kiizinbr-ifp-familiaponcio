"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasAnyRole } from "@/lib/rbac";
import { logEvent } from "@/lib/audit";
import { criarUsuarioSchema } from "@/lib/admin/user-schema";
import { gerarTokenRaw, hashToken, RESET_TOKEN_TTL_MIN } from "@/lib/reset-token";

export type CriarUsuarioResult = { ok: true; email: string } | { ok: false; error: string };

/**
 * Provisiona uma conta real (Fase 1 / Identidade). Só super_admin: cria o User com
 * senha (bcrypt) + a UserRole correspondente em uma transação, e audita. Espelha o
 * padrão do seedUser (prisma/seed.ts) — mas pela UI, não por SQL/seed.
 * Assinatura (prevState, formData) para uso com useActionState.
 */
export async function criarUsuarioAction(
  _prev: CriarUsuarioResult | null,
  formData: FormData,
): Promise<CriarUsuarioResult> {
  const session = await auth();
  if (!hasAnyRole(session, "super_admin")) return { ok: false, error: "Sem permissão" };

  const parsed = criarUsuarioSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    roleName: formData.get("roleName"),
    unitScope: formData.get("unitScope") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const d = parsed.data;

  const existente = await db.user.findUnique({ where: { email: d.email } });
  if (existente) return { ok: false, error: "Já existe um usuário com esse e-mail." };

  const role = await db.role.findUnique({ where: { name: d.roleName } });
  if (!role) return { ok: false, error: "Papel inválido." };

  const hashedPassword = await bcrypt.hash(d.password, 12);

  const novo = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: d.name,
        email: d.email,
        hashedPassword,
        // Senha definida pelo admin é provisória: força troca no 1º login (proxy.ts).
        mustChangePassword: true,
        primaryRoleName: d.roleName,
        primaryUnitScope: d.unitScope,
      },
    });
    await tx.userRole.create({
      data: { userId: user.id, roleId: role.id, unitScope: d.unitScope },
    });
    return user;
  });

  await logEvent({
    userId: session!.user.id,
    action: "user_created",
    entityType: "user",
    entityId: novo.id,
    meta: { email: d.email, roleName: d.roleName, unitScope: d.unitScope },
  });

  revalidatePath("/admin/users");
  return { ok: true, email: d.email };
}

export type LinkResetResult = { ok: true; link: string } | { ok: false; error: string };

/**
 * Gera um link de redefinição de senha (admin-driven, sem e-mail/SMTP). Só super_admin:
 * invalida tokens antigos não usados do usuário, cria um novo (guarda só o hash) e
 * devolve o link `/reset/<raw>` para o super_admin entregar à pessoa. TTL curto.
 */
export async function gerarLinkResetAction(
  _prev: LinkResetResult | null,
  formData: FormData,
): Promise<LinkResetResult> {
  const session = await auth();
  if (!hasAnyRole(session, "super_admin")) return { ok: false, error: "Sem permissão" };

  const userId = String(formData.get("userId") ?? "");
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, error: "Usuário não encontrado." };

  const raw = gerarTokenRaw();
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MIN * 60_000);
  await db.$transaction(async (tx) => {
    await tx.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
    await tx.passwordResetToken.create({
      data: { userId, tokenHash: hashToken(raw), expiresAt },
    });
  });

  await logEvent({
    userId: session!.user.id,
    action: "password_reset",
    entityType: "user",
    entityId: userId,
    meta: { email: user.email, via: "admin_link" },
  });

  return { ok: true, link: `/reset/${raw}` };
}
