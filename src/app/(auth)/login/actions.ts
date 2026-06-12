"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { loginRateLimited } from "@/lib/rate-limit";

/**
 * Sign in com role-based landing.
 *
 * Estrategia: signIn redireciona pra /inicio (resolvedor que le auth() e manda
 * cada papel pro seu destino via getLandingPath). Antes apontava pra /, mas o /
 * agora e a vitrine institucional (aparece sempre, logado ou nao) — entao o
 * pos-login usa o /inicio gateado. Mesmo padrao ja provado no login por unidade
 * (-> /<slug>). Evita o bug do Auth.js v5 beta com { redirect: false } lancando.
 */
export async function signInAction(formData: FormData) {
  const emailRaw = formData.get("email");
  const email = typeof emailRaw === "string" ? emailRaw.trim().toLowerCase() : "";
  const password = formData.get("password");

  if (await loginRateLimited(email, new Date())) {
    redirect("/login?error=rate_limited");
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/inicio",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      await logEvent({
        action: "signin_failed",
        meta: { email },
      });
      redirect("/login?error=invalid");
    }
    // NEXT_REDIRECT do signIn precisa propagar pra fazer o redirect funcionar
    throw error;
  }
}
