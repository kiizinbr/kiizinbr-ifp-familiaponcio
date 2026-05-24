import type { Route } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getLandingPath } from "@/lib/rbac";

export default async function HomePage() {
  const session = await auth();
  redirect(getLandingPath(session) as Route);
}
