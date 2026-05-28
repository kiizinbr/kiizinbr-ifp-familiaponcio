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
    <main className="min-h-screen bg-white p-12">
      <div
        className="mx-auto max-w-3xl rounded-2xl border border-stone-200 p-8"
        style={{ borderLeft: `6px solid ${unidade.corPrimariaPlaceholder}` }}
      >
        <p className="text-xs tracking-wider text-stone-500 uppercase">Unidade</p>
        <h1 className="mt-2 text-3xl font-semibold text-stone-900">{unidade.nome}</h1>
        <p className="mt-4 text-stone-600">Bem-vindo, {session.user.name ?? session.user.email}.</p>
        <p className="mt-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Visual provisório — aguardando Design System v2 e verticalização da unidade.
        </p>
      </div>
    </main>
  );
}
