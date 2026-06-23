"use client";

/**
 * Fila de chegada (recepção) — quem chegou para a consulta de hoje. A recepção
 * marca a presença física do paciente ("Marcar chegada") e acompanha os KPIs de
 * presença. Quem já chegou e ainda não foi triado vira fila da enfermagem.
 */
import Link from "next/link";
import { Clock, ClipboardList, Stethoscope, UserCheck } from "lucide-react";

import { useFilaChegada, useMarcarChegada, type ChegadaItem } from "@/lib/use-medico";
import { PageHeader, Kpi } from "@/components/casa";
import { BadgeRisco } from "@/components/medico/badge-risco";
import { Alerta, Botao, Spinner } from "@/components/ui";
import { idade } from "@/lib/idade";
import { useState } from "react";

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** Só o balcão pode marcar chegada — cancelado/faltoso fica de fora. */
const CHEGAVEL = (a: ChegadaItem) => a.status !== "CANCELADO" && a.status !== "FALTOU";

function ItemChegada({ ag }: { ag: ChegadaItem }) {
  const marcar = useMarcarChegada();
  const [erro, setErro] = useState<string | null>(null);

  async function chegar() {
    setErro(null);
    try {
      await marcar.mutateAsync(ag.id);
    } catch (e) {
      setErro((e as Error).message || "Falha ao marcar chegada.");
    }
  }

  const paciente = ag.membro?.nomeCompleto ?? ag.ficha.nomeCompleto;
  const nascimento = ag.membro?.dataNascimento ?? ag.ficha.dataNascimento;

  return (
    <li className="space-y-2 rounded-lg border border-border bg-surface p-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="w-12 shrink-0 text-center text-sm font-bold text-primary">
          {hora(ag.inicioEm)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-foreground">
            {paciente}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {idade(nascimento)} anos
            </span>
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {ag.profissional.user.nome} · {ag.motivo ?? "Sem motivo"} · {ag.ficha.protocolo}
          </div>
        </div>

        {ag.triagem ? (
          <BadgeRisco risco={ag.triagem.classificacaoRisco} />
        ) : ag.chegouEm ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-success/50 bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
            <UserCheck className="h-3.5 w-3.5" /> Chegou {hora(ag.chegouEm)}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> Aguardando
          </span>
        )}

        {CHEGAVEL(ag) && !ag.chegouEm ? (
          <Botao className="px-3 py-1 text-xs" carregando={marcar.isPending} onClick={chegar}>
            Marcar chegada
          </Botao>
        ) : null}

        {ag.chegouEm ? (
          <Link
            href={`/medico/triagem/${ag.id}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            <Stethoscope className="h-3.5 w-3.5" /> {ag.triagem ? "Ver triagem" : "Triar"}
          </Link>
        ) : null}
      </div>

      {erro ? <Alerta tipo="erro">{erro}</Alerta> : null}
    </li>
  );
}

export default function FilaChegadaPage() {
  const { data, isLoading, isError, error } = useFilaChegada();
  const items = data?.items ?? [];
  const k = data?.kpis;

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <PageHeader
        titulo="Chegada e triagem"
        descricao={new Date().toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "2-digit",
          month: "long",
        })}
      />

      {isLoading ? <Spinner label="Carregando fila..." /> : null}
      {isError ? <Alerta>{(error as Error)?.message}</Alerta> : null}

      {k ? (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Agendados" valor={k.agendados} />
          <Kpi label="Presentes" valor={k.presentes} />
          <Kpi label="Aguard. triagem" valor={k.aguardandoTriagem} alerta={k.aguardandoTriagem > 0} />
          <Kpi label="Triados" valor={k.triados} />
        </div>
      ) : null}

      {data && items.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-muted-foreground">
          <ClipboardList className="mx-auto mb-2 h-6 w-6" />
          Nenhum paciente agendado para hoje.
        </div>
      ) : null}

      <ul className="space-y-2">
        {items.map((ag) => (
          <ItemChegada key={ag.id} ag={ag} />
        ))}
      </ul>
    </main>
  );
}
