import { notFound, redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { unidadeFromSlug, type UnidadeSlug } from "@/lib/unidades";
import { AppShell } from "@/components/app-shell";

/**
 * Home genérica de unidade — serve esportivo/recreativo (médico/capacitação/pôncio/
 * social têm página dedicada com precedência). Antes era um `<main>` cru SEM nav
 * (D8 da auditoria); agora deriva do `AppShell` (sidebar + acento da unidade),
 * dando navegação consistente até estas unidades ganharem painel próprio.
 */
export default async function UnidadeHomePage({
  params,
}: {
  params: Promise<{ unidade: string }>;
}) {
  const { unidade: slug } = await params;
  const unidade = unidadeFromSlug(slug);
  if (!unidade) notFound();

  const session = await auth();
  if (!session) redirect(`/${slug}/login` as Route);
  if (!canAccessUnidade(session, slug)) redirect("/acesso-negado" as Route);

  return (
    <AppShell session={session} unit={slug as UnidadeSlug}>
      <header style={{ marginBottom: 24 }}>
        <p className="micro" style={{ color: "var(--unit)" }}>
          Unidade
        </p>
        <h1 className="t-h1" style={{ marginTop: "var(--sp-2)", color: "var(--text)" }}>
          {unidade.nome}
        </h1>
        <p className="t-body" style={{ marginTop: "var(--sp-4)", color: "var(--text-2)" }}>
          Bem-vindo, {session.user.name ?? session.user.email}. Esta unidade ainda não tem painel
          próprio — use o menu para acessar Cidadãos e os registros transversais.
        </p>
      </header>
    </AppShell>
  );
}
