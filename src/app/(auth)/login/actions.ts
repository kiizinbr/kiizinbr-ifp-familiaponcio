"use server";

import type { Route } from "next";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";
import { getLandingPath } from "@/lib/rbac";

export async function signInAction(formData: FormData) {
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
      redirect("/login?error=invalid");
    }
    throw error;
  }

  // Role-based landing: lê session JWT recém-criado e redireciona
  // pro path apropriado conforme primaryRole (Plano 2 §0.9).
  const session = await auth();
  redirect(getLandingPath(session) as Route);
}
