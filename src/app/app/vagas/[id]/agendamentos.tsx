"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { criarAgendamentoAction, transicionarAgendamento } from "../actions";

export interface AgendamentoView {
  id: string;
  nomeInteressado: string;
  telefone: string;
  horario: string; // ISO
  status: string;
  cidadao: { id: string; nomeCompleto: string } | null;
}

const STATUS_BADGE: Record<string, string> = {
  agendado: "bg-slate-100 text-slate-600",
  confirmado: "bg-sky-100 text-sky-700",
  realizado: "bg-emerald-100 text-emerald-700",
  cancelado: "bg-rose-100 text-rose-700",
  faltou: "bg-amber-100 text-amber-700",
};

const INPUT =
  "w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none transition focus:border-[rgb(var(--ifp-orange-500))] focus:ring-2 focus:ring-[rgb(var(--ifp-orange-500))]/20";

function formatHorario(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AgendamentosPanel({
  vagaId,
  podeAgendar,
  podeAgendarNovo,
  agendamentos,
}: {
  vagaId: string;
  podeAgendar: boolean;
  podeAgendarNovo: boolean;
  agendamentos: AgendamentoView[];
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <section className="ifp-card p-6">
        <h2 className="mb-1 text-lg font-semibold tracking-tight">Agendamentos</h2>
        <p className="mb-4 text-sm text-[rgb(var(--ifp-muted))]">
          {agendamentos.length} {agendamentos.length === 1 ? "entrevista" : "entrevistas"}
        </p>
        {agendamentos.length === 0 ? (
          <p className="py-8 text-center text-sm text-[rgb(var(--ifp-muted))]">
            Nenhum agendamento ainda.
          </p>
        ) : (
          <ul className="divide-y divide-black/[0.06]">
            {agendamentos.map((a) => (
              <AgendamentoRow key={a.id} ag={a} podeAgendar={podeAgendar} />
            ))}
          </ul>
        )}
      </section>

      {podeAgendar && podeAgendarNovo && <NovoAgendamentoForm vagaId={vagaId} />}
    </div>
  );
}

function AgendamentoRow({ ag, podeAgendar }: { ag: AgendamentoView; podeAgendar: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const terminal = ag.status === "cancelado" || ag.status === "faltou";

  function acao(a: "confirmar" | "cancelar" | "faltou" | "realizar") {
    setErro(null);
    start(async () => {
      const r = await transicionarAgendamento(ag.id, a);
      if (r.ok) router.refresh();
      else setErro(r.error);
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <div className="min-w-[180px] flex-1">
        <p className="text-sm font-semibold">{ag.nomeInteressado}</p>
        <p className="text-xs text-[rgb(var(--ifp-muted))]">
          {ag.telefone} · {formatHorario(ag.horario)}
        </p>
      </div>
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[ag.status]}`}>
        {ag.status}
      </span>

      {podeAgendar && !terminal && ag.status !== "realizado" && (
        <div className="flex flex-wrap gap-1.5">
          {ag.status === "agendado" && (
            <ActionBtn label="Confirmar" onClick={() => acao("confirmar")} pending={pending} />
          )}
          <ActionBtn label="Realizar" onClick={() => acao("realizar")} pending={pending} primary />
          <ActionBtn label="Faltou" onClick={() => acao("faltou")} pending={pending} />
          <ActionBtn label="Cancelar" onClick={() => acao("cancelar")} pending={pending} />
        </div>
      )}

      {ag.cidadao ? (
        <Link
          href={`/app/cidadaos/${ag.cidadao.id}` as Route}
          className="text-xs font-semibold text-[rgb(var(--ifp-orange-500))] hover:underline"
        >
          Ver ficha →
        </Link>
      ) : (
        podeAgendar && (
          <Link
            href={
              `/app/cidadaos/novo?nome=${encodeURIComponent(ag.nomeInteressado)}&tel=${encodeURIComponent(ag.telefone)}` as Route
            }
            className="text-xs font-semibold text-[rgb(var(--ifp-orange-500))] hover:underline"
          >
            Criar ficha →
          </Link>
        )
      )}
      {erro && <p className="w-full text-xs text-rose-600">{erro}</p>}
    </li>
  );
}

function ActionBtn({
  label,
  onClick,
  pending,
  primary,
}: {
  label: string;
  onClick: () => void;
  pending: boolean;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={pending}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition disabled:opacity-50 ${
        primary
          ? "bg-[rgb(var(--ifp-orange-500))] text-white hover:-translate-y-0.5"
          : "border border-black/10 text-[rgb(var(--ifp-ink))] hover:bg-[#f3f3f5]"
      }`}
    >
      {label}
    </button>
  );
}

function NovoAgendamentoForm({ vagaId }: { vagaId: string }) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [horario, setHorario] = useState("");
  const [consente, setConsente] = useState(true);
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    start(async () => {
      const r = await criarAgendamentoAction(vagaId, {
        nomeInteressado: nome,
        telefone,
        horario,
        consenteContato: consente,
        observacoes: obs,
      });
      if (r.ok) {
        setNome("");
        setTelefone("");
        setHorario("");
        setObs("");
        router.refresh();
      } else {
        setErro(r.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="ifp-card h-fit space-y-3 p-6">
      <h2 className="text-lg font-semibold tracking-tight">Novo agendamento</h2>
      <input
        aria-label="Nome do interessado"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Nome do interessado"
        className={INPUT}
      />
      <input
        aria-label="Telefone"
        value={telefone}
        onChange={(e) => setTelefone(e.target.value)}
        placeholder="(21) 99999-0000"
        className={INPUT}
      />
      <input
        aria-label="Horário"
        type="datetime-local"
        value={horario}
        onChange={(e) => setHorario(e.target.value)}
        className={INPUT}
      />
      <input
        aria-label="Observações"
        value={obs}
        onChange={(e) => setObs(e.target.value)}
        placeholder="Observações (opcional)"
        className={INPUT}
      />
      <label className="flex items-center gap-2 text-sm text-[rgb(var(--ifp-muted))]">
        <input type="checkbox" checked={consente} onChange={(e) => setConsente(e.target.checked)} />
        Consente contato (WhatsApp/telefone)
      </label>
      {erro && <p className="text-sm text-rose-600">{erro}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-[rgb(var(--ifp-orange-500))] px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
      >
        {pending ? "Agendando…" : "Agendar entrevista"}
      </button>
    </form>
  );
}
