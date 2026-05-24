import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { KpiCard } from "@/components/kpi-card";

export default async function SocialDashboard() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <AppShell session={session}>
      <header className="mb-8">
        <p className="text-xs tracking-widest text-slate-500 uppercase">Serviço Social</p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-900">Triagens & casos ativos</h1>
        <p className="mt-2 text-sm text-slate-600">
          Painel da equipe socioeconômica — Regina e equipe atendem casos das 4 unidades.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Triagens pendentes"
          value="15"
          delta="+3"
          accent="laranja"
          hint="esta semana"
        />
        <KpiCard label="Casos ativos" value="87" accent="esportivo" hint="acompanhamento" />
        <KpiCard
          label="Famílias atendidas (mês)"
          value="62"
          delta="+18%"
          accent="recreativo"
          hint="vs mês anterior"
        />
        <KpiCard
          label="Visitas domiciliares"
          value="24"
          accent="cinza"
          hint="agendadas esta semana"
        />
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <Panel title="Triagens prioritárias">
          <PriorityItem
            family="Família Almeida"
            unit="medico"
            unitLabel="Centro Médico"
            status="Aguardando aprovação"
            urgency="alta"
          />
          <PriorityItem
            family="Família Costa"
            unit="capacitacao"
            unitLabel="Capacitação"
            status="Documentação incompleta"
            urgency="média"
          />
          <PriorityItem
            family="Família Souza"
            unit="recreativo"
            unitLabel="Recreativo"
            status="Visita marcada"
            urgency="baixa"
          />
          <PriorityItem
            family="Família Pereira"
            unit="esportivo"
            unitLabel="Esportivo"
            status="Pendente entrevista"
            urgency="média"
          />
        </Panel>

        <Panel title="Casos por unidade">
          <UnitDistribution unit="medico" label="Centro Médico" count={32} percent={37} />
          <UnitDistribution unit="capacitacao" label="Capacitação" count={18} percent={21} />
          <UnitDistribution unit="esportivo" label="Esportivo" count={21} percent={24} />
          <UnitDistribution unit="recreativo" label="Recreativo" count={16} percent={18} />
        </Panel>
      </section>

      <section className="mt-10">
        <Panel title="Indicadores socioeconômicos do mês">
          <li className="grid gap-4 py-2 sm:grid-cols-3">
            <Indicator
              label="Renda média familiar"
              value="R$ 1.420"
              hint="abaixo do meio salário"
            />
            <Indicator label="Famílias em situação vulnerável" value="48" hint="55% do total" />
            <Indicator label="Beneficiários Bolsa Família" value="34" hint="39% do total" />
          </li>
        </Panel>
      </section>
    </AppShell>
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

function PriorityItem({
  family,
  unit,
  unitLabel,
  status,
  urgency,
}: {
  family: string;
  unit: "medico" | "capacitacao" | "esportivo" | "recreativo";
  unitLabel: string;
  status: string;
  urgency: "alta" | "média" | "baixa";
}) {
  const urgencyColor =
    urgency === "alta"
      ? "bg-red-100 text-red-700"
      : urgency === "média"
        ? "bg-amber-100 text-amber-700"
        : "bg-slate-100 text-slate-600";
  return (
    <li className="flex items-start gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <span
        className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ background: `rgb(var(--ifp-${unit}))` }}
      />
      <div className="flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-slate-900">{family}</p>
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${urgencyColor}`}>
            {urgency}
          </span>
        </div>
        <p className="text-xs text-slate-500">
          {unitLabel} · {status}
        </p>
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
  unit: "medico" | "capacitacao" | "esportivo" | "recreativo";
  label: string;
  count: number;
  percent: number;
}) {
  return (
    <li className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-700">{label}</span>
        <span className="font-medium text-slate-900">{count} casos</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-slate-100">
        <div
          className="h-full rounded"
          style={{ width: `${percent}%`, background: `rgb(var(--ifp-${unit}))` }}
        />
      </div>
    </li>
  );
}

function Indicator({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div>
      <p className="text-xs tracking-wide text-slate-500 uppercase">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
    </div>
  );
}
