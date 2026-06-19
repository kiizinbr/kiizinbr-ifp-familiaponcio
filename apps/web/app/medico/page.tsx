"use client";

import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  ListOrdered,
  Stethoscope,
  Users,
} from "lucide-react";

import { useAgendaDoDia } from "@/lib/use-medico";

const ATALHOS = [
  {
    href: "/medico/agenda",
    titulo: "Agenda do dia",
    desc: "Abrir a prancha, agendar pacientes e gerir o dia.",
    icone: CalendarDays,
  },
  {
    href: "/medico/fila",
    titulo: "Fila do dia",
    desc: "Quem está aguardando, em atendimento e concluído.",
    icone: ListOrdered,
  },
  {
    href: "/medico/beneficiarios",
    titulo: "Beneficiários",
    desc: "Pacientes elegíveis, ficha clínica, alergias e condições.",
    icone: Users,
  },
  {
    href: "/medico/prontuarios",
    titulo: "Prontuários",
    desc: "Histórico dos atendimentos que você selou.",
    icone: FileText,
  },
];

function Kpi({
  rotulo,
  valor,
  icone,
}: {
  rotulo: string;
  valor: number | string;
  icone: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-ifp-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {rotulo}
        </span>
        <span className="text-primary">{icone}</span>
      </div>
      <div className="mt-2 text-3xl font-bold text-foreground">{valor}</div>
    </div>
  );
}

export default function MedicoHome() {
  const { data } = useAgendaDoDia();
  const items = data?.items ?? [];
  const aguardando = items.filter(
    (a) => a.status === "AGENDADO" || a.status === "CONFIRMADO",
  ).length;
  const emAtendimento = items.filter((a) => a.status === "EM_ATENDIMENTO").length;
  const concluidos = items.filter((a) => a.status === "CONCLUIDO").length;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-bold text-foreground">Centro Médico</h1>
      <p className="mt-1 text-sm text-muted-foreground">Visão de hoje, em tempo real.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi rotulo="Pacientes hoje" valor={items.length} icone={<CalendarDays className="h-5 w-5" />} />
        <Kpi rotulo="Aguardando" valor={aguardando} icone={<Clock className="h-5 w-5" />} />
        <Kpi rotulo="Em atendimento" valor={emAtendimento} icone={<Stethoscope className="h-5 w-5" />} />
        <Kpi rotulo="Concluídos" valor={concluidos} icone={<CheckCircle2 className="h-5 w-5" />} />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ATALHOS.map((a) => {
          const Icone = a.icone;
          return (
            <Link
              key={a.href}
              href={a.href}
              className="group rounded-lg border border-border bg-surface p-5 shadow-ifp-sm transition hover:shadow-casa-sm"
            >
              <Icone className="h-6 w-6 text-primary" />
              <h2 className="mt-3 font-semibold text-foreground group-hover:text-primary">
                {a.titulo}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{a.desc}</p>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
