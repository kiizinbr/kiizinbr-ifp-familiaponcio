"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";

/**
 * Sign in com role-based landing.
 *
 * Estrategia: signIn redireciona pra /, que e server component que le auth()
 * e calcula getLandingPath(session). Isso evita o bug do Auth.js v5 beta com
 * { redirect: false } sempre lancando, e funciona ponta-a-ponta.
 */
export async function signInAction(formData: FormData) {
  const email = formData.get("email");
  const password = formData.get("password");

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?error=invalid");
    }
    // NEXT_REDIRECT do signIn precisa propagar pra fazer o redirect funcionar
    throw error;
  }
}
