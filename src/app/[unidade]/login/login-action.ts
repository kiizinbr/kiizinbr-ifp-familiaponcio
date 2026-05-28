"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { db } from "@/lib/db";
import { unidadeFromSlug } from "@/lib/unidades";
import { logEvent } from "@/lib/audit";
import type { RoleAssignment, RoleName, UnitScope } from "@/lib/rbac-types";

/**
 * Login por unidade.
 *
 * Workaround do bug do Auth.js v5 beta com `{ redirect: false }` (sempre lança;
 * mesmo padrão usado em src/app/(auth)/login/actions.ts): a gente faz a
 * verificação manual de credenciais + acesso à unidade ANTES de chamar signIn,
 * e só então delega ao signIn com `redirectTo` pra ele cuidar de cookie+redirect.
 *
 * Assim conseguimos:
 *   - "E-mail ou senha incorretos" antes de mexer em cookie/sessão
 *   - "Não foi possível acessar essa unidade" quando o user existe mas a role
 *     dele não cobre a unidade visitada (mata o vetor de "loga no /medico
 *     mesmo sem ser do médico")
 *   - redirect bem comportado pra `/<slug>` quando tudo OK
 */
export async function unidadeLoginAction(
  slug: string,
  formData: FormData,
): Promise<{ error?: string } | void> {
  const unidade = unidadeFromSlug(slug);
  if (!unidade) return { error: "Unidade desconhecida." };

  const emailRaw = formData.get("email");
  const passwordRaw = formData.get("password");
  const email = typeof emailRaw === "string" ? emailRaw.trim().toLowerCase() : null;
  const password = typeof passwordRaw === "string" ? passwordRaw : null;

  if (!email || !password) {
    return { error: "E-mail ou senha incorretos." };
  }

  // Pre-flight 1: usuário existe + senha confere
  const user = await db.user.findUnique({ where: { email } });
  if (!user?.hashedPassword || !(await bcrypt.compare(password, user.hashedPassword))) {
    await logEvent({
      action: "signin_failed",
      meta: { email, unidade: slug },
    });
    return { error: "E-mail ou senha incorretos." };
  }

  // Pre-flight 2: role cobre essa unidade?
  const userRoles = await db.userRole.findMany({
    where: { userId: user.id },
    include: { role: true },
  });
  const roles: RoleAssignment[] = userRoles.map((ur) => ({
    name: ur.role.name as RoleName,
    unitScope: (ur.unitScope as UnitScope | null) ?? null,
  }));
  const isSuper = roles.some((r) => r.name === "super_admin");
  const canAccess =
    isSuper ||
    unidade.rolesAceitas.some((aceita) =>
      roles.some((r) => r.name === aceita.name && r.unitScope === aceita.unitScope),
    );

  if (!canAccess) {
    await logEvent({
      userId: user.id,
      action: "signin_denied_unit",
      meta: { email, unidade: slug },
    });
    return {
      error: "Não foi possível acessar essa unidade. Verifique se você está no link correto.",
    };
  }

  // Tudo OK: delega o setup de cookie/sessão + redirect ao signIn.
  // NEXT_REDIRECT do signIn precisa propagar (sem try/catch genérico).
  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: `/${slug}`,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      // Caso muito raro (race entre check e signIn) — degrada pra mesma msg.
      return { error: "E-mail ou senha incorretos." };
    }
    throw error;
  }
}
