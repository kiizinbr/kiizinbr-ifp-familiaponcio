import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { getVaga, podeAgendar, slotsDisponiveis } from "@/lib/funil";
import type { UnitScope } from "@/lib/rbac-types";
import { AgendamentosPanel, type AgendamentoView } from "./agendamentos";

const UNIT_LABELS: Record<UnitScope, string> = {
  medico: "Centro Médico",
  capacitacao: "Centro de Capacitação",
  esportivo: "Centro Esportivo",
  recreativo: "Centro Recreativo",
};

const STATUS_BADGE: Record<string, string> = {
  aberta: "bg-emerald-100 text-emerald-700",
  pausada: "bg-amber-100 text-amber-700",
  encerrada: "bg-slate-100 text-slate-600",
};

export default async function VagaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const vaga = await getVaga(id, session);
  if (!vaga) notFound();

  const disp = slotsDisponiveis(vaga.slotsTotais, vaga.agendamentos);
  const agendar = podeAgendar(session);

  const view: AgendamentoView[] = vaga.agendamentos.map((a) => ({
    id: a.id,
    nomeInteressado: a.nomeInteressado,
    telefone: a.telefone,
    horario: a.horario.toISOString(),
    status: a.status,
    cidadao: a.cidadao ? { id: a.cidadao.id, nomeCompleto: a.cidadao.nomeCompleto } : null,
  }));

  return (
    <AppShell session={session}>
      <header className="mb-8">
        <Link
          href={"/app/vagas" as Route}
          className="text-xs text-[rgb(var(--ifp-muted))] hover:text-[rgb(var(--ifp-laranja))]"
        >
          ← Voltar para Vagas
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">{vaga.titulo}</h1>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[vaga.status]}`}
          >
            {vaga.status}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-[rgb(var(--ifp-muted))]">
          <span
            className="rounded px-2 py-0.5 text-xs font-medium text-white"
            style={{ background: `rgb(var(--ifp-${vaga.unidade}))` }}
          >
            {UNIT_LABELS[vaga.unidade as UnitScope]}
          </span>
          <span>•</span>
          <span>
            <strong className="text-[rgb(var(--ifp-ink))]">{disp}</strong> de {vaga.slotsTotais}{" "}
            slots livres
          </span>
        </div>
        {vaga.descricao && (
          <p className="mt-3 max-w-2xl text-sm text-[rgb(var(--ifp-muted))]">{vaga.descricao}</p>
        )}
      </header>

      <AgendamentosPanel
        vagaId={vaga.id}
        podeAgendar={agendar}
        podeAgendarNovo={vaga.status === "aberta" && disp > 0}
        agendamentos={view}
      />
    </AppShell>
  );
}
