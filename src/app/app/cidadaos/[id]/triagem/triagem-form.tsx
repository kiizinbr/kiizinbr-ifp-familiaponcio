"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  abrirTriagem,
  salvarEntrevista,
  concluirTriagem,
  decidirElegibilidade,
} from "../triagem-actions";

const UNIDADES = [
  { value: "medico", label: "Centro Médico" },
  { value: "capacitacao", label: "Centro de Capacitação" },
  { value: "esportivo", label: "Centro Esportivo" },
  { value: "recreativo", label: "Centro Recreativo" },
] as const;

const STATUS_OPS = [
  { value: "pendente", label: "Pendente" },
  { value: "aprovado", label: "Aprovado" },
  { value: "negado", label: "Negado" },
  { value: "encaminhado", label: "Encaminhado" },
];

const STATUS_BADGE: Record<string, string> = {
  pendente: "bg-slate-100 text-slate-600",
  aprovado: "bg-emerald-100 text-emerald-700",
  negado: "bg-red-100 text-red-700",
  encaminhado: "bg-amber-100 text-amber-700",
};

export interface TriagemData {
  id: string;
  status: "aberta" | "concluida";
  dataEntrevista: string;
  parecer: string;
  observacoes: string;
  elegibilidades: { unidade: string; status: string; motivo: string }[];
}

/** Botão de abrir triagem (quando o cidadão ainda não tem nenhuma). */
export function AbrirTriagemButton({ cidadaoId }: { cidadaoId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  return (
    <div>
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await abrirTriagem(cidadaoId);
            if (r.ok) router.refresh();
            else setErro(r.error);
          })
        }
        className="rounded bg-[rgb(var(--ifp-laranja))] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Abrindo…" : "Abrir triagem"}
      </button>
      {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
    </div>
  );
}

/** Formulário completo de uma triagem: entrevista + conclusão + elegibilidade por unidade. */
export function TriagemForm({ triagem }: { triagem: TriagemData }) {
  const router = useRouter();
  const concluida = triagem.status === "concluida";

  const [dataEntrevista, setDataEntrevista] = useState(triagem.dataEntrevista);
  const [parecer, setParecer] = useState(triagem.parecer);
  const [observacoes, setObservacoes] = useState(triagem.observacoes);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [closing, startClose] = useTransition();

  function salvar() {
    setMsg(null);
    startSave(async () => {
      const r = await salvarEntrevista(triagem.id, { dataEntrevista, parecer, observacoes });
      setMsg(r.ok ? "Entrevista salva." : r.error);
      if (r.ok) router.refresh();
    });
  }

  function concluir() {
    setMsg(null);
    startClose(async () => {
      const r = await concluirTriagem(triagem.id);
      if (r.ok) router.refresh();
      else setMsg(r.error);
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium tracking-wide text-slate-700 uppercase">Entrevista</h2>
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${
              concluida ? "bg-violet-100 text-violet-700" : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {concluida ? "Concluída" : "Aberta"}
          </span>
        </div>

        <div className="grid gap-4">
          <div className="max-w-xs">
            <label
              htmlFor="data-entrevista"
              className="mb-1 block text-xs font-medium text-slate-600"
            >
              Data da entrevista
            </label>
            <input
              id="data-entrevista"
              type="date"
              value={dataEntrevista}
              disabled={concluida}
              onChange={(e) => setDataEntrevista(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
          <div>
            <label htmlFor="parecer" className="mb-1 block text-xs font-medium text-slate-600">
              Parecer
            </label>
            <textarea
              id="parecer"
              rows={4}
              value={parecer}
              disabled={concluida}
              onChange={(e) => setParecer(e.target.value)}
              placeholder="Avaliação socioeconômica e parecer da assistente social"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
          <div>
            <label htmlFor="observacoes" className="mb-1 block text-xs font-medium text-slate-600">
              Observações
            </label>
            <textarea
              id="observacoes"
              rows={3}
              value={observacoes}
              disabled={concluida}
              onChange={(e) => setObservacoes(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
        </div>

        {!concluida && (
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={salvar}
              disabled={saving}
              className="rounded border border-slate-300 px-4 py-2 text-sm transition hover:bg-slate-50 disabled:opacity-60"
            >
              {saving ? "Salvando…" : "Salvar entrevista"}
            </button>
            <button
              onClick={concluir}
              disabled={closing}
              className="rounded bg-[rgb(var(--ifp-laranja))] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {closing ? "Concluindo…" : "Concluir triagem"}
            </button>
          </div>
        )}
        {msg && <p className="mt-3 text-sm text-slate-600">{msg}</p>}
      </section>

      <ElegibilidadeGrid triagem={triagem} />
    </div>
  );
}

function ElegibilidadeGrid({ triagem }: { triagem: TriagemData }) {
  return (
    <section className="rounded-lg border bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-sm font-medium tracking-wide text-slate-700 uppercase">
          Elegibilidade por unidade
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Decisão manual da assistente social. Aprovar ao menos uma unidade ativa o cadastro.
        </p>
      </div>
      <div className="space-y-3">
        {UNIDADES.map((u) => {
          const atual = triagem.elegibilidades.find((e) => e.unidade === u.value);
          return (
            <ElegibilidadeRow
              key={u.value}
              triagemId={triagem.id}
              unidadeValue={u.value}
              unidadeLabel={u.label}
              statusInicial={atual?.status ?? "pendente"}
              motivoInicial={atual?.motivo ?? ""}
            />
          );
        })}
      </div>
    </section>
  );
}

function ElegibilidadeRow({
  triagemId,
  unidadeValue,
  unidadeLabel,
  statusInicial,
  motivoInicial,
}: {
  triagemId: string;
  unidadeValue: string;
  unidadeLabel: string;
  statusInicial: string;
  motivoInicial: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(statusInicial);
  const [motivo, setMotivo] = useState(motivoInicial);
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function salvar() {
    setErro(null);
    start(async () => {
      const r = await decidirElegibilidade(triagemId, unidadeValue, status, motivo);
      if (r.ok) router.refresh();
      else setErro(r.error);
    });
  }

  return (
    <div
      data-testid={`eleg-row-${unidadeValue}`}
      className="flex flex-wrap items-center gap-3 rounded border border-slate-200 p-3"
    >
      <span className="w-44 text-sm font-medium text-slate-800">{unidadeLabel}</span>
      <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[statusInicial]}`}>
        {statusInicial}
      </span>
      <select
        aria-label={`Status ${unidadeLabel}`}
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="rounded border border-slate-300 px-2 py-1.5 text-sm"
      >
        {STATUS_OPS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <input
        aria-label={`Motivo ${unidadeLabel}`}
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="Motivo (opcional)"
        className="min-w-[160px] flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
      <button
        onClick={salvar}
        disabled={pending}
        className="rounded border border-slate-300 px-3 py-1.5 text-sm transition hover:bg-slate-50 disabled:opacity-60"
      >
        {pending ? "…" : "Salvar"}
      </button>
      {erro && <p className="w-full text-xs text-red-600">{erro}</p>}
    </div>
  );
}
