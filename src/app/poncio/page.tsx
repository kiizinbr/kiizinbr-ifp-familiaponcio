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
    <main
      className="min-h-screen"
      style={{
        backgroundColor: "rgb(var(--ifp-surface-50))",
        padding: "var(--ifp-space-12)",
      }}
    >
      <div className="mx-auto max-w-5xl">
        <p className="text-xs tracking-wider uppercase" style={{ color: "rgb(var(--ifp-muted))" }}>
          Pôncio Executivo
        </p>
        <h1 className="mt-2 text-3xl font-bold" style={{ color: "rgb(var(--ifp-orange-900))" }}>
          Visão geral das unidades
        </h1>
        <p className="mt-2" style={{ color: "rgb(var(--ifp-ink))" }}>
          Bem-vindo, {session.user.name ?? session.user.email}.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {UNIDADES_OPERACIONAIS.map((slug) => {
            const u = UNIDADES[slug];
            return (
              <div
                key={slug}
                style={{
                  backgroundColor: "rgb(var(--ifp-canvas))",
                  border: "1px solid rgb(var(--ifp-surface-200))",
                  borderTop: `4px solid ${u.corFiltroLogin}`,
                  borderRadius: "var(--ifp-radius-md)",
                  boxShadow: "var(--ifp-shadow-sm)",
                  padding: "var(--ifp-space-6)",
                }}
              >
                <h2 className="font-bold" style={{ color: "rgb(var(--ifp-ink))" }}>
                  {u.nome}
                </h2>
                <p className="mt-2 text-sm" style={{ color: "rgb(var(--ifp-muted))" }}>
                  Indicadores serão exibidos aqui.
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
