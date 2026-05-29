import { notFound, redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { unidadeFromSlug } from "@/lib/unidades";

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
  if (!canAccessUnidade(session, slug)) redirect("/" as Route);

  return (
    <main
      className="min-h-screen"
      style={{
        backgroundColor: "rgb(var(--ifp-surface-50))",
        padding: "var(--ifp-space-12)",
      }}
    >
      <div
        className="mx-auto max-w-3xl"
        style={{
          backgroundColor: "rgb(var(--ifp-canvas))",
          border: "1px solid rgb(var(--ifp-surface-200))",
          borderLeft: `6px solid ${unidade.corFiltroLogin}`,
          borderRadius: "var(--ifp-radius-lg)",
          boxShadow: "var(--ifp-shadow-sm)",
          padding: "var(--ifp-space-8)",
        }}
      >
        <p className="text-xs tracking-wider uppercase" style={{ color: "rgb(var(--ifp-muted))" }}>
          Unidade
        </p>
        <h1 className="mt-2 text-3xl font-bold" style={{ color: "rgb(var(--ifp-orange-900))" }}>
          {unidade.nome}
        </h1>
        <p className="mt-4" style={{ color: "rgb(var(--ifp-ink))" }}>
          Bem-vindo, {session.user.name ?? session.user.email}.
        </p>
      </div>
    </main>
  );
}
