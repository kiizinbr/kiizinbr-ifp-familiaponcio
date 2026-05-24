import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { KpiCard } from "@/components/kpi-card";

export default async function GlobalDashboard() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <AppShell session={session}>
      <header className="mb-8">
        <p className="text-xs tracking-widest text-slate-500 uppercase">Visão geral</p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-900">
          Olá, {session.user.name?.split(" ")[0] ?? "Erick"}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Resumo consolidado das 4 unidades do Instituto Família Pôncio.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Atendimentos no mês"
          value="1.247"
          delta="+12%"
          accent="laranja"
          hint="vs mês anterior"
        />
        <KpiCard
          label="Cidadãos ativos"
          value="892"
          delta="+34"
          accent="esportivo"
          hint="novos este mês"
        />
        <KpiCard label="Triagens pendentes" value="15" accent="cinza" hint="aguardando aprovação" />
        <KpiCard label="Profissionais ativos" value="48" accent="cinza" hint="nas 4 unidades" />
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-sm font-medium tracking-wide text-slate-700 uppercase">
          Unidades
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <UnitSummary
            color="medico"
            name="Centro Médico"
            atendimentos={512}
            ativos={324}
            href="/app/medico"
          />
          <UnitSummary
            color="capacitacao"
            name="Capacitação"
            atendimentos={184}
            ativos={180}
            href="/app/capacitacao"
          />
          <UnitSummary
            color="esportivo"
            name="Esportivo"
            atendimentos={278}
            ativos={240}
            href="/app/esportivo"
          />
          <UnitSummary
            color="recreativo"
            name="Recreativo"
            atendimentos={273}
            ativos={148}
            href="/app/recreativo"
          />
        </div>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <Panel title="Pendências">
          <PendingItem label="Aprovação de 3 triagens socioeconômicas" highlight="Hoje" />
          <PendingItem label="Reunião quinzenal com coordenadoras" highlight="Amanhã 10h" />
          <PendingItem label="Renovação de convênio Centro Médico" highlight="3 dias" />
        </Panel>

        <Panel title="Atividade recente">
          <ActivityItem
            who="Luciana"
            what="cadastrou nova turma de informática básica"
            when="há 2h"
            accent="capacitacao"
          />
          <ActivityItem
            who="Regina"
            what="aprovou triagem da família Almeida"
            when="há 4h"
            accent="laranja"
          />
          <ActivityItem
            who="Livia"
            what="atualizou cronograma de futebol infantil"
            when="ontem"
            accent="esportivo"
          />
        </Panel>
      </section>
    </AppShell>
  );
}

function UnitSummary({
  color,
  name,
  atendimentos,
  ativos,
  href,
}: {
  color: "medico" | "capacitacao" | "esportivo" | "recreativo";
  name: string;
  atendimentos: number;
  ativos: number;
  href: string;
}) {
  return (
    <a href={href} className="block rounded-lg border bg-white p-4 transition hover:shadow-md">
      <div className={`h-1 w-8 rounded bg-[rgb(var(--ifp-${color}))]`} />
      <h3 className="mt-3 text-sm font-medium text-slate-900">{name}</h3>
      <div className="mt-3 flex items-baseline gap-3">
        <div>
          <p className="text-xs text-slate-500">Atendimentos</p>
          <p className="text-lg font-semibold text-slate-900">{atendimentos}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Ativos</p>
          <p className="text-lg font-semibold text-slate-900">{ativos}</p>
        </div>
      </div>
    </a>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-white p-5 shadow-sm">
      <h2 className="text-sm font-medium tracking-wide text-slate-700 uppercase">{title}</h2>
      <ul className="mt-4 space-y-3">{children}</ul>
    </div>
  );
}

function PendingItem({ label, highlight }: { label: string; highlight: string }) {
  return (
    <li className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <span className="text-sm text-slate-700">{label}</span>
      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
        {highlight}
      </span>
    </li>
  );
}

function ActivityItem({
  who,
  what,
  when,
  accent,
}: {
  who: string;
  what: string;
  when: string;
  accent: "medico" | "capacitacao" | "esportivo" | "recreativo" | "laranja";
}) {
  return (
    <li className="flex items-start gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <span
        className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ background: `rgb(var(--ifp-${accent}))` }}
      />
      <div className="flex-1 text-sm">
        <span className="font-medium text-slate-900">{who}</span>{" "}
        <span className="text-slate-600">{what}</span>
        <p className="text-xs text-slate-500">{when}</p>
      </div>
    </li>
  );
}
