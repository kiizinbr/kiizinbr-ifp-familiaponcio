import { redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { UNIDADES } from "@/lib/unidades";
import { AppShell } from "@/components/app-shell";

const UNIDADES_OPERACIONAIS = ["medico", "capacitacao", "esportivo", "recreativo"] as const;

/**
 * Pôncio Executivo — home da presidência. Antes era um `<main>` cru sem nav (D8);
 * agora deriva do `AppShell` (sidebar + acento pôncio), consistente com as demais.
 */
export default async function PoncioDashboardPage() {
  const session = await auth();
  if (!session) redirect("/poncio/login" as Route);
  if (!canAccessUnidade(session, "poncio")) redirect("/acesso-negado" as Route);

  return (
    <AppShell session={session} unit="poncio">
      <header style={{ marginBottom: 24 }}>
        <p className="micro" style={{ color: "var(--accent)" }}>
          Pôncio Executivo
        </p>
        <h1 className="t-h1" style={{ color: "var(--text)", marginTop: "var(--sp-2)" }}>
          Visão geral das unidades
        </h1>
        <p style={{ color: "var(--text-2)", marginTop: "var(--sp-2)", fontSize: 14 }}>
          Bem-vindo, {session.user.name ?? session.user.email}.
        </p>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: "var(--sp-4)",
        }}
      >
        {UNIDADES_OPERACIONAIS.map((slug) => {
          const u = UNIDADES[slug];
          return (
            <div key={slug} className="card" style={{ position: "relative", overflow: "hidden" }}>
              {/* faixa de cor de dado da unidade (mantida do brandbook) */}
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  insetInline: 0,
                  top: 0,
                  height: 4,
                  background: u.corFiltroLogin,
                }}
              />
              <div className="body" style={{ paddingTop: 18 }}>
                <h2 className="t-h3" style={{ color: "var(--text)" }}>
                  {u.nome}
                </h2>
                <p style={{ color: "var(--text-3)", fontSize: 13, marginTop: "var(--sp-2)" }}>
                  Indicadores serão exibidos aqui.
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
