import { redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { KpiCard } from "@/components/kpi-card";
import { getCidadaoStats } from "@/lib/cidadao";
import { countTriagensAbertas, listTriagensPendentes } from "@/lib/triagem";
import type { UnitScope } from "@/lib/rbac-types";

const UNIT_LABELS: Record<UnitScope, string> = {
  medico: "Centro Médico",
  capacitacao: "Capacitação",
  esportivo: "Esportivo",
  recreativo: "Recreativo",
  educacional: "Educacional",
};

/** Cor de dado (identidade da unidade) — preservada nos ladrilhos. */
const UNIT_COLOR: Record<UnitScope, string> = {
  medico: "var(--u-medico)",
  capacitacao: "var(--u-capacitacao)",
  esportivo: "var(--u-esportivo)",
  recreativo: "var(--u-recreativo)",
  educacional: "var(--u-educacional)",
};

const ACTIVITY_LABELS: Record<string, string> = {
  signin_success: "entrou no sistema",
  signout: "saiu do sistema",
  ficha_created: "cadastrou uma ficha",
  ficha_updated: "atualizou uma ficha",
  anexo_uploaded: "anexou um documento",
  anexo_removed: "removeu um anexo",
  triagem_aberta: "abriu uma triagem",
  triagem_concluida: "concluiu uma triagem",
  elegibilidade_decidida: "decidiu uma elegibilidade",
  role_changed: "alterou um papel",
};

function formatDateTime(date: Date): string {
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface PanelItem {
  key: string;
  primary: string;
  secondary?: string;
  href?: string;
}

/** Painel kit: card com header (tick + título) + lista de itens (primary/secondary/href). */
function Panel({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: PanelItem[];
  emptyText: string;
}) {
  return (
    <div className="card">
      <header>
        <span className="tick" aria-hidden="true" />
        <h3>{title}</h3>
      </header>
      <div className="body">
        {items.length === 0 ? (
          <p className="t-small" style={{ color: "var(--text-3)", margin: 0 }}>
            {emptyText}
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {items.map((it, i) => (
              <li
                key={it.key}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "10px 0",
                  borderTop: i === 0 ? "none" : "1px solid var(--line)",
                }}
              >
                {it.href ? (
                  <Link
                    href={it.href as Route}
                    style={{
                      fontSize: 13.5,
                      fontWeight: 600,
                      color: "var(--text)",
                      textDecoration: "none",
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {it.primary}
                  </Link>
                ) : (
                  <span
                    style={{
                      fontSize: 13.5,
                      fontWeight: 600,
                      color: "var(--text)",
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {it.primary}
                  </span>
                )}
                {it.secondary && (
                  <span
                    className="mono"
                    style={{ fontSize: 11.5, color: "var(--text-3)", flexShrink: 0 }}
                  >
                    {it.secondary}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * "Início" — painel cross-unidade dos papéis globais (super_admin / presidência).
 * Antes vivia em /app (GlobalDashboard), inalcançável pelo alias do proxy; movido
 * para /inicio em 2026-06-08 (doc docs/ux-navegacao-ia-2026-06-08.md). Os ladrilhos
 * de unidade agora apontam para a home real da unidade (/medico, /capacitacao…),
 * não para o dashboard mock legado /app/[unit].
 */
export default async function InicioDashboard() {
  const session = await auth();
  if (!session) redirect("/login");

  const [stats, triagensAbertas, pendentes, atividade] = await Promise.all([
    getCidadaoStats(session),
    countTriagensAbertas(session),
    listTriagensPendentes(session),
    db.auditLog.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true, email: true } } },
    }),
  ]);

  const porUnidade = new Map((stats?.porUnidade ?? []).map((u) => [u.unidade, u.total]));

  const agora = new Date();
  const dataWeekday = agora.toLocaleDateString("pt-BR", { weekday: "long" });
  const dataFull = agora.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const firstName = session.user.name?.split(" ")[0] ?? "Erick";

  const triagensItems: PanelItem[] = pendentes.slice(0, 6).map((t) => ({
    key: t.id,
    primary: t.cidadao.nomeCompleto,
    secondary: UNIT_LABELS[t.cidadao.unitIdOrigem as UnitScope],
    href: `/app/cidadaos/${t.cidadao.id}/triagem`,
  }));

  const atividadeItems: PanelItem[] = atividade.map((a) => ({
    key: a.id,
    primary: `${a.user?.name ?? a.user?.email ?? "Sistema"} ${
      ACTIVITY_LABELS[a.action] ?? a.action
    }`,
    secondary: formatDateTime(a.createdAt),
  }));

  return (
    <AppShell session={session}>
      <header style={{ marginBottom: 24 }}>
        <p className="micro" style={{ color: "var(--accent)", marginBottom: 7 }}>
          Instituto Família Pôncio · Início
        </p>
        <h1 className="t-h1" style={{ color: "var(--text)" }}>
          Olá, {firstName}
        </h1>
        <p style={{ marginTop: 6, fontSize: 13, color: "var(--text-3)" }}>
          {dataWeekday} · {dataFull}
        </p>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 28,
        }}
      >
        <KpiCard label="Total de cidadãos" value={`${stats?.total ?? 0}`} hint="cadastros" />
        <KpiCard label="Ativos" value={`${stats?.ativos ?? 0}`} hint="vigentes" />
        <KpiCard label="Triagens pendentes" value={`${triagensAbertas}`} hint="em aberto" />
        <KpiCard label="Excluídos" value={`${stats?.deletados ?? 0}`} hint="LGPD" />
      </div>

      <h2 className="t-h2" style={{ color: "var(--text)", marginBottom: 14 }}>
        Unidades
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          marginBottom: 28,
        }}
      >
        {(Object.keys(UNIT_LABELS) as UnitScope[]).map((u) => (
          <Link
            key={u}
            href={`/${u}` as Route}
            className="card card-hover"
            style={{
              position: "relative",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              padding: 17,
              textDecoration: "none",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: "0 0 auto 0",
                height: 3,
                background: UNIT_COLOR[u],
              }}
            />
            <span className="micro" style={{ color: "var(--text-3)" }}>
              {UNIT_LABELS[u]}
            </span>
            <span
              className="mono"
              style={{
                fontSize: 30,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                lineHeight: 1,
                color: "var(--text)",
              }}
            >
              {porUnidade.get(u) ?? 0}
            </span>
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>cidadãos ativos</span>
          </Link>
        ))}
      </div>

      <h2 className="t-h2" style={{ color: "var(--text)", marginBottom: 14 }}>
        Acompanhamento
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        <Panel
          title="Triagens pendentes"
          items={triagensItems}
          emptyText="Nenhuma triagem pendente."
        />
        <Panel
          title="Atividade recente"
          items={atividadeItems}
          emptyText="Sem atividade registrada."
        />
      </div>
    </AppShell>
  );
}
