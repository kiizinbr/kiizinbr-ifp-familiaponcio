"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { auth, signIn } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { unidadeFromSlug } from "@/lib/unidades";
import { logEvent } from "@/lib/audit";

export async function unidadeLoginAction(
  slug: string,
  formData: FormData,
): Promise<{ error?: string } | void> {
  const unidade = unidadeFromSlug(slug);
  if (!unidade) return { error: "Unidade desconhecida." };

  const email = formData.get("email");
  const password = formData.get("password");

  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      await logEvent({
        action: "signin_failed",
        meta: {
          email: typeof email === "string" ? email : null,
          unidade: slug,
        },
      });
      return { error: "E-mail ou senha incorretos." };
    }
    throw error;
  }

  const session = await auth();
  if (!session) {
    return { error: "E-mail ou senha incorretos." };
  }

  if (!canAccessUnidade(session, slug)) {
    await logEvent({
      action: "signin_denied_unit",
      meta: { email: session.user.email, unidade: slug },
    });
    return {
      error: "Não foi possível acessar essa unidade. Verifique se você está no link correto.",
    };
  }

  redirect(`/${slug}` as Route);
}
