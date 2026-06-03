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
  agendado: "badge badge-default",
  confirmado: "badge badge-info",
  realizado: "badge badge-success",
  cancelado: "badge badge-danger",
  faltou: "badge badge-warning",
};

const INPUT = "input";

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
      <section className="card p-6">
        <h2 className="t-h3 mb-1">Agendamentos</h2>
        <p className="mb-4 text-sm text-[var(--text-3)]">
          {agendamentos.length} {agendamentos.length === 1 ? "entrevista" : "entrevistas"}
        </p>
        {agendamentos.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--text-3)]">Nenhum agendamento ainda.</p>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
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
        <p className="text-sm font-semibold text-[var(--text)]">{ag.nomeInteressado}</p>
        <p className="text-xs text-[var(--text-3)]">
          <span className="mono">{ag.telefone}</span> · {formatHorario(ag.horario)}
        </p>
      </div>
      <span className={STATUS_BADGE[ag.status]}>{ag.status}</span>

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
          className="text-xs font-semibold text-[var(--accent)] hover:underline"
        >
          Ver ficha →
        </Link>
      ) : (
        podeAgendar && (
          <Link
            href={
              `/app/cidadaos/novo?nome=${encodeURIComponent(ag.nomeInteressado)}&tel=${encodeURIComponent(ag.telefone)}` as Route
            }
            className="text-xs font-semibold text-[var(--accent)] hover:underline"
          >
            Criar ficha →
          </Link>
        )
      )}
      {erro && <p className="field-error w-full">{erro}</p>}
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
      className={`btn btn-sm ${primary ? "btn-primary" : "btn-secondary"}`}
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
    <form onSubmit={onSubmit} className="card h-fit space-y-3 p-6">
      <h2 className="t-h3">Novo agendamento</h2>
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
      <label className="flex items-center gap-2 text-sm text-[var(--text-2)]">
        <input type="checkbox" checked={consente} onChange={(e) => setConsente(e.target.checked)} />
        Consente contato (WhatsApp/telefone)
      </label>
      {erro && <p className="field-error">{erro}</p>}
      <button type="submit" disabled={pending} className="btn btn-primary btn-block">
        {pending ? "Agendando…" : "Agendar entrevista"}
      </button>
    </form>
  );
}
