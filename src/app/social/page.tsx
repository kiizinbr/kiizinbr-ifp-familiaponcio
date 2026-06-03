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
        <p className="micro">Serviço Social</p>
        <h1 className="t-h1 mt-1">Triagens &amp; casos ativos</h1>
        <p className="text-3 mt-2 text-sm">
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
            <li className="text-3 text-sm">Nenhuma triagem pendente. 🎉</li>
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
            <li className="text-3 text-sm">Sem dados ainda.</li>
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
    <div className="card">
      <header>
        <span className="tick" />
        <h3>{title}</h3>
      </header>
      <ul className="body space-y-3">{children}</ul>
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
    <li
      className="flex items-start gap-3 pb-3 last:border-0 last:pb-0"
      style={{ borderBottom: "1px solid var(--line)" }}
    >
      <span
        className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ background: `rgb(var(--ifp-filter-${unit}))` }}
      />
      <div className="flex-1">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/app/cidadaos/${cidadaoId}/triagem` as Route}
            className="text-sm font-medium"
            style={{ color: "var(--text)" }}
          >
            {nome}
          </Link>
          <span className="text-3 mono text-xs">aberta {formatDate(abertaEm)}</span>
        </div>
        <p className="text-3 text-xs">{UNIT_LABELS[unit]}</p>
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
    <li className="pb-3 last:border-0 last:pb-0" style={{ borderBottom: "1px solid var(--line)" }}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-2">{label}</span>
        <span className="mono font-medium" style={{ color: "var(--text)" }}>
          {count} casos
        </span>
      </div>
      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded"
        style={{ background: "var(--surface-sunken)" }}
      >
        <div
          className="h-full rounded"
          style={{ width: `${percent}%`, background: `rgb(var(--ifp-filter-${unit}))` }}
        />
      </div>
    </li>
  );
}
