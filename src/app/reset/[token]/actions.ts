"use server";

import { redirect } from "next/navigation";
import type { Route } from "next";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { hashToken, tokenExpirado } from "@/lib/reset-token";
import { logEvent } from "@/lib/audit";
import { validarTrocaSenha } from "@/lib/senha";

export type DefinirSenhaResult = { ok: false; error: string };

/**
 * Define a nova senha a partir do token de reset (admin-driven). Valida hash +
 * uso único + expiração; troca a senha (bcrypt), marca o token usado e invalida os
 * demais não usados do mesmo usuário, tudo em transação. Assinatura (token, prev, form)
 * para uso com useActionState via .bind(null, token).
 */
export async function definirNovaSenhaAction(
  token: string,
  _prev: DefinirSenhaResult | null,
  formData: FormData,
): Promise<DefinirSenhaResult> {
  const senha = String(formData.get("password") ?? "");
  const confirma = String(formData.get("confirm") ?? "");
  const erroSenha = validarTrocaSenha(senha, confirma);
  if (erroSenha) return { ok: false, error: erroSenha };

  const reg = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!reg || reg.usedAt || tokenExpirado(reg.expiresAt, new Date())) {
    return { ok: false, error: "Link inválido ou expirado. Peça um novo ao administrador." };
  }

  const hashedPassword = await bcrypt.hash(senha, 12);
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: reg.userId },
      data: { hashedPassword, mustChangePassword: false },
    });
    await tx.passwordResetToken.updateMany({
      where: { userId: reg.userId, usedAt: null },
      data: { usedAt: new Date() },
    });
  });

  await logEvent({
    userId: reg.userId,
    action: "password_reset",
    entityType: "user",
    entityId: reg.userId,
    meta: { email: reg.user.email, via: "token" },
  });

  redirect("/login?reset=ok" as Route);
}
