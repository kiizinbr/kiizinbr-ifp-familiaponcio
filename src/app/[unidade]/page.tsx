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
      className="ifp-kit"
      data-unit={slug}
      data-unit-accent=""
      style={{ minHeight: "100vh", padding: "var(--sp-12)" }}
    >
      <div
        className="card mx-auto"
        style={{
          maxWidth: 768,
          borderLeft: "6px solid var(--unit)",
          padding: "var(--sp-8)",
        }}
      >
        <p className="micro" style={{ color: "var(--unit)" }}>
          Unidade
        </p>
        <h1 className="t-h1" style={{ marginTop: "var(--sp-2)", color: "var(--text)" }}>
          {unidade.nome}
        </h1>
        <p className="t-body" style={{ marginTop: "var(--sp-4)", color: "var(--text-2)" }}>
          Bem-vindo, {session.user.name ?? session.user.email}.
        </p>
      </div>
    </main>
  );
}
