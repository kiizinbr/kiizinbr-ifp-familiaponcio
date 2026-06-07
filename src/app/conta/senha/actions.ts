"use server";

import bcrypt from "bcryptjs";
import { auth, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/audit";
import { validarTrocaSenhaVoluntaria } from "@/lib/senha";

export type TrocarSenhaResult = { ok: false; error: string };

/**
 * Troca a senha do PRÓPRIO usuário logado (troca obrigatória no 1º acesso ou
 * mudança voluntária). Valida, grava o hash (bcrypt), limpa o mustChangePassword
 * e desloga — a pessoa entra de novo já com a senha nova, com um JWT limpo (a
 * sessão atual ainda carrega mustChangePassword=true). Assinatura (prev, form)
 * para useActionState.
 */
export async function trocarMinhaSenhaAction(
  _prev: TrocarSenhaResult | null,
  formData: FormData,
): Promise<TrocarSenhaResult> {
  const session = await auth();
  if (!session) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const senha = String(formData.get("password") ?? "");
  const confirma = String(formData.get("confirm") ?? "");

  // Fora do 1º acesso (forçado), exige provar a senha ATUAL — senão uma sessão
  // roubada (XSS/estação aberta) viraria takeover permanente da conta.
  const forcado = session.user.mustChangePassword === true;
  let senhaAtualConfere = forcado;
  if (!forcado) {
    const senhaAtual = String(formData.get("currentPassword") ?? "");
    const dbUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { hashedPassword: true },
    });
    senhaAtualConfere =
      !!dbUser?.hashedPassword && (await bcrypt.compare(senhaAtual, dbUser.hashedPassword));
  }

  const erro = validarTrocaSenhaVoluntaria({
    forcado,
    senhaAtualConfere,
    novaSenha: senha,
    confirma,
  });
  if (erro) return { ok: false, error: erro };

  const hashedPassword = await bcrypt.hash(senha, 12);
  await db.user.update({
    where: { id: session.user.id },
    data: { hashedPassword, mustChangePassword: false },
  });

  await logEvent({
    userId: session.user.id,
    action: "password_reset",
    entityType: "user",
    entityId: session.user.id,
    meta: { via: forcado ? "primeiro_acesso" : "voluntaria" },
  });

  // signOut redireciona (não retorna); o return abaixo só satisfaz o tipo.
  await signOut({ redirectTo: "/login?senha=ok" });
  return { ok: false, error: "" };
}
