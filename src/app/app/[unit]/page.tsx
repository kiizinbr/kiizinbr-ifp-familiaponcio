import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { KpiCard } from "@/components/kpi-card";
import { UNIT_SCOPES, type UnitScope } from "@/lib/rbac-types";
import { listEncaminhamentosUnidade } from "@/lib/triagem";

interface UnitData {
  name: string;
  tagline: string;
  kpis: { label: string; value: string; delta?: string; hint?: string }[];
  agenda: { hora: string; descricao: string; status?: "confirmado" | "pendente" }[];
  highlights: { titulo: string; detalhe: string }[];
}

const UNITS: Record<UnitScope, UnitData> = {
  medico: {
    name: "Centro Médico",
    tagline: "Atendimentos médicos, exames e acompanhamento clínico.",
    kpis: [
      { label: "Atendimentos hoje", value: "32", delta: "+5", hint: "vs ontem" },
      { label: "Pacientes ativos", value: "324", hint: "em acompanhamento" },
      { label: "Profissionais escalados", value: "12", hint: "turno manhã + tarde" },
      { label: "Salas ocupadas", value: "4 / 5", hint: "80% capacidade" },
    ],
    agenda: [
      { hora: "08:00", descricao: "Consulta — Maria Silva (clínica geral)", status: "confirmado" },
      { hora: "08:30", descricao: "Retorno — João Pereira (cardiologia)", status: "confirmado" },
      { hora: "09:00", descricao: "Exame — Ana Costa (laboratório)", status: "pendente" },
      { hora: "09:30", descricao: "Consulta — Pedro Santos (pediatria)", status: "confirmado" },
      {
        hora: "10:00",
        descricao: "Visita socioassistencial — Família Almeida",
        status: "pendente",
      },
    ],
    highlights: [
      { titulo: "Convênio em renovação", detalhe: "Vencimento em 3 dias — pendente assinatura" },
      { titulo: "Campanha de vacinação", detalhe: "Iniciada ontem · 47 doses aplicadas" },
      { titulo: "Indicador clínico", detalhe: "Taxa de retorno em 14d: 82% (meta 85%)" },
    ],
  },
  capacitacao: {
    name: "Centro de Capacitação",
    tagline: "Cursos profissionalizantes e desenvolvimento de competências.",
    kpis: [
      { label: "Alunos ativos", value: "184", delta: "+12", hint: "novos este mês" },
      { label: "Turmas em andamento", value: "8", hint: "presencial + híbrido" },
      { label: "Taxa de frequência", value: "87%", delta: "+3pp", hint: "vs mês anterior" },
      { label: "Conclusões previstas", value: "42", hint: "próximas 4 semanas" },
    ],
    agenda: [
      { hora: "08:00", descricao: "Informática Básica T3 · sala 1", status: "confirmado" },
      { hora: "09:30", descricao: "Costura Industrial · sala 4", status: "confirmado" },
      { hora: "13:30", descricao: "Marketing Digital · sala 2", status: "confirmado" },
      { hora: "15:00", descricao: "Reunião com Luciana e equipe", status: "pendente" },
      { hora: "18:00", descricao: "Inglês Iniciante (noturno) · sala 1", status: "confirmado" },
    ],
    highlights: [
      { titulo: "Nova turma de informática", detalhe: "Inscrições abertas até 15/06 — 18 vagas" },
      { titulo: "Parceria SENAI", detalhe: "Aguardando confirmação para 2 cursos técnicos" },
      { titulo: "Certificações emitidas", detalhe: "32 este mês (informática + costura)" },
    ],
  },
  esportivo: {
    name: "Centro Esportivo",
    tagline: "Modalidades esportivas e formação atlética.",
    kpis: [
      { label: "Atletas inscritos", value: "240", delta: "+8", hint: "novos este mês" },
      {
        label: "Modalidades ativas",
        value: "6",
        hint: "fut, vôlei, basquete, judô, capoeira, dança",
      },
      { label: "Treinos esta semana", value: "18", hint: "manhã, tarde e noite" },
      { label: "Frequência média", value: "78%", delta: "+5pp", hint: "vs mês anterior" },
    ],
    agenda: [
      { hora: "07:00", descricao: "Futebol infantil sub-12 · campo 1", status: "confirmado" },
      { hora: "09:00", descricao: "Capoeira adulta · ginásio", status: "confirmado" },
      { hora: "14:00", descricao: "Vôlei feminino sub-15 · quadra coberta", status: "confirmado" },
      {
        hora: "16:00",
        descricao: "Reunião com Livia · planejamento campeonato",
        status: "pendente",
      },
      { hora: "19:00", descricao: "Judô adulto · tatame", status: "confirmado" },
    ],
    highlights: [
      { titulo: "Campeonato interno", detalhe: "Final do torneio de futebol em 14 dias" },
      {
        titulo: "Doação de uniformes",
        detalhe: "32 kits recebidos — distribuição na próxima semana",
      },
      { titulo: "Avaliação física", detalhe: "Próxima rodada agendada · 65 atletas" },
    ],
  },
  recreativo: {
    name: "Centro Recreativo",
    tagline: "Atividades lúdicas, culturais e socioeducativas.",
    kpis: [
      { label: "Frequentadores ativos", value: "148", delta: "+22", hint: "novos este mês" },
      { label: "Atividades no mês", value: "24", hint: "oficinas + eventos" },
      { label: "Voluntários atuantes", value: "9", hint: "fixos + esporádicos" },
      { label: "Taxa de retorno", value: "85%", delta: "+4pp", hint: "vs mês anterior" },
    ],
    agenda: [
      {
        hora: "08:30",
        descricao: "Oficina de leitura infantil · biblioteca",
        status: "confirmado",
      },
      { hora: "10:00", descricao: "Roda de conversa idosos · sala multiuso", status: "confirmado" },
      { hora: "14:00", descricao: "Música — aulas de violão · sala 3", status: "confirmado" },
      { hora: "15:30", descricao: "Pintura em tela · ateliê", status: "pendente" },
      { hora: "18:00", descricao: "Reunião com Danielle · próximo evento", status: "pendente" },
    ],
    highlights: [
      { titulo: "Festival comunitário", detalhe: "Programado para 28/06 · 200 pessoas previstas" },
      { titulo: "Parceria biblioteca municipal", detalhe: "Doação de 80 livros confirmada" },
      { titulo: "Oficina nova", detalhe: "Robótica educacional inicia em 2 semanas" },
    ],
  },
};

export default async function UnitDashboard({ params }: { params: Promise<{ unit: string }> }) {
  const { unit } = await params;
  if (!UNIT_SCOPES.includes(unit as UnitScope)) notFound();

  const session = await auth();
  if (!session) redirect("/login");

  const data = UNITS[unit as UnitScope];
  const accent = unit as UnitScope;
  const encaminhamentos = await listEncaminhamentosUnidade(unit, session);

  return (
    <AppShell session={session}>
      <header className="mb-8">
        <p className="text-xs tracking-widest text-[rgb(var(--ifp-muted))] uppercase">Centro</p>
        <h1 className="mt-1 text-3xl font-semibold text-[rgb(var(--ifp-ink))]">{data.name}</h1>
        <p className="mt-2 text-sm text-[rgb(var(--ifp-muted))]">{data.tagline}</p>
      </header>

      <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
        KPIs, agenda e destaques abaixo são <strong>dados de exemplo</strong> — a integração com as
        fontes reais de cada unidade entra numa próxima fase. O painel{" "}
        <strong>Encaminhamentos da triagem</strong> já usa dados reais.
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data.kpis.map((kpi, i) => (
          <KpiCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            delta={kpi.delta}
            hint={kpi.hint}
            accent={i === 0 ? accent : "cinza"}
          />
        ))}
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <Panel title="Agenda de hoje" accent={accent}>
          {data.agenda.map((item) => (
            <AgendaItem
              key={`${item.hora}-${item.descricao}`}
              hora={item.hora}
              descricao={item.descricao}
              status={item.status}
              accent={accent}
            />
          ))}
        </Panel>

        <Panel title="Destaques operacionais" accent={accent}>
          {data.highlights.map((h) => (
            <HighlightItem key={h.titulo} titulo={h.titulo} detalhe={h.detalhe} accent={accent} />
          ))}
        </Panel>
      </section>

      <section className="mt-10">
        <Panel title="Encaminhamentos da triagem" accent={accent}>
          {encaminhamentos.length === 0 ? (
            <li className="text-sm text-[rgb(var(--ifp-muted))]">
              Nenhum encaminhamento do Serviço Social para esta unidade ainda.
            </li>
          ) : (
            encaminhamentos.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 last:border-0 last:pb-0"
              >
                <Link
                  href={`/app/cidadaos/${e.triagem.cidadao.id}` as Route}
                  className="text-sm font-medium text-[rgb(var(--ifp-ink))] hover:text-[rgb(var(--ifp-orange-500))]"
                >
                  {e.triagem.cidadao.nomeCompleto}
                </Link>
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                    e.status === "aprovado"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {e.status}
                </span>
              </li>
            ))
          )}
        </Panel>
      </section>
    </AppShell>
  );
}

function Panel({
  title,
  accent,
  children,
}: {
  title: string;
  accent: UnitScope;
  children: React.ReactNode;
}) {
  return (
    <div className="ifp-card p-6">
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-1 w-6 rounded"
          style={{ background: `rgb(var(--ifp-filter-${accent}))` }}
        />
        <h2 className="text-sm font-medium tracking-wide text-slate-700 uppercase">{title}</h2>
      </div>
      <ul className="mt-4 space-y-3">{children}</ul>
    </div>
  );
}

function AgendaItem({
  hora,
  descricao,
  status,
  accent,
}: {
  hora: string;
  descricao: string;
  status?: "confirmado" | "pendente";
  accent: UnitScope;
}) {
  return (
    <li className="flex items-start gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <span
        className="rounded px-2 py-0.5 text-xs font-medium text-white tabular-nums"
        style={{ background: `rgb(var(--ifp-filter-${accent}))` }}
      >
        {hora}
      </span>
      <div className="flex-1">
        <p className="text-sm text-slate-700">{descricao}</p>
        {status && (
          <p className="mt-0.5 text-xs text-[rgb(var(--ifp-muted))] capitalize">{status}</p>
        )}
      </div>
    </li>
  );
}

function HighlightItem({
  titulo,
  detalhe,
  accent,
}: {
  titulo: string;
  detalhe: string;
  accent: UnitScope;
}) {
  return (
    <li className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <div className="flex items-start gap-2">
        <span
          className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full"
          style={{ background: `rgb(var(--ifp-filter-${accent}))` }}
        />
        <div>
          <p className="text-sm font-medium text-[rgb(var(--ifp-ink))]">{titulo}</p>
          <p className="mt-0.5 text-xs text-[rgb(var(--ifp-muted))]">{detalhe}</p>
        </div>
      </div>
    </li>
  );
}
