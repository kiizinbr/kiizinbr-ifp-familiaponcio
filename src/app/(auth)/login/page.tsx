import clsx from "clsx";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { LoginForm } from "./login-form";
import { TemaUnidade } from "@/components/tema-unidade";
import { auth } from "@/lib/auth";
import { getLandingPath } from "@/lib/rbac";
import { temaCasaDoSlug } from "@/lib/tema-casa";
import { unidadeFromSlug } from "@/lib/unidades";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; unidade?: string }>;
}) {
  // Quem já está logado não vê o formulário de login: vai pro seu destino real.
  // O guard `home !== "/login"` evita loop residual (getLandingPath nunca devolve
  // /login pra sessão válida desde o fix B3, mas a rede dupla é barata).
  const session = await auth();
  if (session) {
    const home = getLandingPath(session);
    if (home !== "/login") redirect(home as Route);
  }

  const params = await searchParams;
  // ?unidade=<slug> tematiza o login (vindo de /acesso). Slug inválido/ausente
  // → tema null (sem data-unit) e o login fica neutro, como sempre foi.
  const tema = temaCasaDoSlug(params.unidade);
  const unidade = tema ? unidadeFromSlug(tema) : null;
  return (
    <TemaUnidade tema={tema}>
      <main
        className={clsx(
          "grid min-h-screen place-items-center",
          tema ? "bg-background" : "bg-slate-50",
        )}
      >
        <LoginForm
          error={params.error}
          unidade={unidade ? { slug: unidade.slug, nome: unidade.nome } : undefined}
        />
      </main>
    </TemaUnidade>
  );
}
