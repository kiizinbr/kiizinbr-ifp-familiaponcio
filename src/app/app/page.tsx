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

export default async function GlobalDashboard() {
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

  return (
    <AppShell session={session}>
      <header className="mb-8">
        <p className="text-xs tracking-widest text-[rgb(var(--ifp-muted))] uppercase">
          Visão geral
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-[rgb(var(--ifp-ink))]">
          Olá, {session.user.name?.split(" ")[0] ?? "Erick"}
        </h1>
        <p className="mt-2 text-sm text-[rgb(var(--ifp-muted))]">
          Resumo consolidado das 4 unidades do Instituto Família Pôncio.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total de cidadãos"
          value={String(stats?.total ?? 0)}
          accent="laranja"
          hint="cadastros na plataforma"
        />
        <KpiCard
          label="Cidadãos ativos"
          value={String(stats?.ativos ?? 0)}
          accent="esportivo"
          hint="não excluídos / anonimizados"
        />
        <KpiCard
          label="Triagens pendentes"
          value={String(triagensAbertas)}
          accent="cinza"
          hint="entrevistas em aberto"
        />
        <KpiCard
          label="Excluídos"
          value={String(stats?.deletados ?? 0)}
          accent="cinza"
          hint="soft delete (LGPD)"
        />
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-sm font-medium tracking-wide text-slate-700 uppercase">
          Unidades
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(UNIT_LABELS) as UnitScope[]).map((u) => (
            <UnitSummary
              key={u}
              color={u}
              name={UNIT_LABELS[u]}
              ativos={porUnidade.get(u) ?? 0}
              href={`/app/${u}`}
            />
          ))}
        </div>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <Panel title="Triagens pendentes">
          {pendentes.length === 0 ? (
            <li className="text-sm text-[rgb(var(--ifp-muted))]">Nenhuma triagem pendente.</li>
          ) : (
            pendentes.slice(0, 6).map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0"
              >
                <Link
                  href={`/app/cidadaos/${t.cidadao.id}/triagem` as Route}
                  className="text-sm font-medium text-[rgb(var(--ifp-ink))] hover:text-[rgb(var(--ifp-laranja))]"
                >
                  {t.cidadao.nomeCompleto}
                </Link>
                <span className="text-xs text-[rgb(var(--ifp-muted))]">
                  {UNIT_LABELS[t.cidadao.unitIdOrigem as UnitScope]}
                </span>
              </li>
            ))
          )}
        </Panel>

        <Panel title="Atividade recente">
          {atividade.length === 0 ? (
            <li className="text-sm text-[rgb(var(--ifp-muted))]">Sem atividade registrada.</li>
          ) : (
            atividade.map((a) => (
              <li
                key={a.id}
                className="flex items-start gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0"
              >
                <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-[rgb(var(--ifp-laranja))]" />
                <div className="flex-1 text-sm">
                  <span className="font-medium text-[rgb(var(--ifp-ink))]">
                    {a.user?.name ?? a.user?.email ?? "Sistema"}
                  </span>{" "}
                  <span className="text-[rgb(var(--ifp-muted))]">
                    {ACTIVITY_LABELS[a.action] ?? a.action}
                  </span>
                  <p className="text-xs text-[rgb(var(--ifp-muted))]">
                    {formatDateTime(a.createdAt)}
                  </p>
                </div>
              </li>
            ))
          )}
        </Panel>
      </section>
    </AppShell>
  );
}

function UnitSummary({
  color,
  name,
  ativos,
  href,
}: {
  color: UnitScope;
  name: string;
  ativos: number;
  href: string;
}) {
  return (
    <Link
      href={href as Route}
      className="block rounded-lg border bg-white p-4 transition hover:shadow-md"
    >
      <div className={`h-1 w-8 rounded bg-[rgb(var(--ifp-${color}))]`} />
      <h3 className="mt-3 text-sm font-medium text-[rgb(var(--ifp-ink))]">{name}</h3>
      <div className="mt-3">
        <p className="text-xs text-[rgb(var(--ifp-muted))]">Cidadãos ativos</p>
        <p className="text-lg font-semibold text-[rgb(var(--ifp-ink))]">{ativos}</p>
      </div>
    </Link>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="ifp-card p-6">
      <h2 className="text-sm font-medium tracking-wide text-slate-700 uppercase">{title}</h2>
      <ul className="mt-4 space-y-3">{children}</ul>
    </div>
  );
}
