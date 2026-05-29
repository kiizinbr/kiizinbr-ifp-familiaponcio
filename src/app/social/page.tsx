import { redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
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

function formatDate(date: Date): string {
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default async function SocialDashboard() {
  const session = await auth();
  if (!session) redirect("/social/login" as Route);
  if (!canAccessUnidade(session, "social")) redirect("/" as Route);

  const [triagensAbertas, pendentes, stats] = await Promise.all([
    countTriagensAbertas(session),
    listTriagensPendentes(session),
    getCidadaoStats(session),
  ]);

  const totalAtivos = stats?.ativos ?? 0;

  return (
    <AppShell session={session}>
      <header className="mb-8">
        <p className="text-xs tracking-widest text-[rgb(var(--ifp-muted))] uppercase">
          Serviço Social
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-[rgb(var(--ifp-ink))]">
          Triagens &amp; casos ativos
        </h1>
        <p className="mt-2 text-sm text-[rgb(var(--ifp-muted))]">
          Painel da equipe socioeconômica — Regina e equipe atendem casos das 4 unidades.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="Triagens pendentes"
          value={String(triagensAbertas)}
          accent="laranja"
          hint="entrevistas em aberto"
        />
        <KpiCard
          label="Cidadãos ativos"
          value={String(totalAtivos)}
          accent="esportivo"
          hint="cadastros ativos"
        />
        <KpiCard
          label="Total de cidadãos"
          value={String(stats?.total ?? 0)}
          accent="recreativo"
          hint="todas as unidades"
        />
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <Panel title="Triagens pendentes">
          {pendentes.length === 0 ? (
            <li className="text-sm text-[rgb(var(--ifp-muted))]">Nenhuma triagem pendente. 🎉</li>
          ) : (
            pendentes.map((t) => (
              <TriagemItem
                key={t.id}
                cidadaoId={t.cidadao.id}
                nome={t.cidadao.nomeCompleto}
                unit={t.cidadao.unitIdOrigem as UnitScope}
                abertaEm={t.createdAt}
              />
            ))
          )}
        </Panel>

        <Panel title="Cidadãos ativos por unidade">
          {!stats || stats.porUnidade.length === 0 ? (
            <li className="text-sm text-[rgb(var(--ifp-muted))]">Sem dados ainda.</li>
          ) : (
            stats.porUnidade.map((u) => (
              <UnitDistribution
                key={u.unidade}
                unit={u.unidade}
                label={UNIT_LABELS[u.unidade]}
                count={u.total}
                percent={totalAtivos > 0 ? Math.round((u.total / totalAtivos) * 100) : 0}
              />
            ))
          )}
        </Panel>
      </section>
    </AppShell>
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

function TriagemItem({
  cidadaoId,
  nome,
  unit,
  abertaEm,
}: {
  cidadaoId: string;
  nome: string;
  unit: UnitScope;
  abertaEm: Date;
}) {
  return (
    <li className="flex items-start gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <span
        className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ background: `rgb(var(--ifp-filter-${unit}))` }}
      />
      <div className="flex-1">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/app/cidadaos/${cidadaoId}/triagem` as Route}
            className="text-sm font-medium text-[rgb(var(--ifp-ink))] hover:text-[rgb(var(--ifp-orange-500))]"
          >
            {nome}
          </Link>
          <span className="text-xs text-slate-400">aberta {formatDate(abertaEm)}</span>
        </div>
        <p className="text-xs text-[rgb(var(--ifp-muted))]">{UNIT_LABELS[unit]}</p>
      </div>
    </li>
  );
}

function UnitDistribution({
  unit,
  label,
  count,
  percent,
}: {
  unit: UnitScope;
  label: string;
  count: number;
  percent: number;
}) {
  return (
    <li className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-700">{label}</span>
        <span className="font-medium text-[rgb(var(--ifp-ink))]">{count} casos</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-slate-100">
        <div
          className="h-full rounded"
          style={{ width: `${percent}%`, background: `rgb(var(--ifp-filter-${unit}))` }}
        />
      </div>
    </li>
  );
}
