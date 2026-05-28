import { redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { UNIDADES } from "@/lib/unidades";

const UNIDADES_OPERACIONAIS = ["medico", "capacitacao", "esportivo", "recreativo"] as const;

export default async function PoncioDashboardPage() {
  const session = await auth();
  if (!session) redirect("/poncio/login" as Route);
  if (!canAccessUnidade(session, "poncio")) redirect("/" as Route);

  return (
    <main className="min-h-screen bg-stone-50 p-12">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs tracking-wider text-stone-500 uppercase">Pôncio Executivo</p>
        <h1 className="mt-2 text-3xl font-semibold text-stone-900">Visão geral das unidades</h1>
        <p className="mt-2 text-stone-600">Bem-vindo, {session.user.name ?? session.user.email}.</p>

        <div className="mt-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Visual provisório — aguardando Design System v2 e KPIs reais.
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {UNIDADES_OPERACIONAIS.map((slug) => {
            const u = UNIDADES[slug];
            return (
              <div
                key={slug}
                className="rounded-xl border border-stone-200 bg-white p-6"
                style={{ borderTop: `4px solid ${u.corPrimariaPlaceholder}` }}
              >
                <h2 className="font-semibold text-stone-900">{u.nome}</h2>
                <p className="mt-2 text-sm text-stone-500">Indicadores serão exibidos aqui.</p>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
