"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { loginRateLimited } from "@/lib/rate-limit";

/**
 * Sign in com role-based landing.
 *
 * Estrategia: signIn redireciona pra /, que e server component que le auth()
 * e calcula getLandingPath(session). Isso evita o bug do Auth.js v5 beta com
 * { redirect: false } sempre lancando, e funciona ponta-a-ponta.
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
      redirectTo: "/",
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
