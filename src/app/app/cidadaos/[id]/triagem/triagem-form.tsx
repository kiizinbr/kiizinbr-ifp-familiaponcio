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
  pendente: "bg-slate-100 text-[rgb(var(--ifp-muted))] ring-slate-200",
  aprovado: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  negado: "bg-rose-50 text-rose-700 ring-rose-200",
  encaminhado: "bg-amber-50 text-amber-700 ring-amber-200",
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
        className="inline-flex items-center gap-2 rounded-full bg-[rgb(var(--ifp-laranja))] px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[rgb(var(--ifp-laranja))]/30 transition hover:-translate-y-0.5 hover:shadow-md disabled:translate-y-0 disabled:opacity-60"
      >
        {pending ? "Abrindo…" : "Abrir triagem"}
        <span aria-hidden>→</span>
      </button>
      {erro && <p className="mt-2 text-sm text-rose-600">{erro}</p>}
    </div>
  );
}

/** Jornada da triagem: Aberta → Entrevista → Elegibilidade → Concluída. */
function Jornada({ triagem }: { triagem: TriagemData }) {
  const temEntrevista = Boolean(triagem.parecer || triagem.dataEntrevista);
  const temDecisao = triagem.elegibilidades.some((e) => e.status !== "pendente");
  const concluida = triagem.status === "concluida";

  const passos = [
    { label: "Aberta", done: true },
    { label: "Entrevista", done: temEntrevista },
    { label: "Elegibilidade", done: temDecisao },
    { label: "Concluída", done: concluida },
  ];

  return (
    <ol className="flex items-center gap-1 text-xs">
      {passos.map((p, i) => (
        <li key={p.label} className="flex flex-1 items-center gap-1">
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ring-2 transition ${
              p.done
                ? "bg-[rgb(var(--ifp-laranja))] text-white ring-[rgb(var(--ifp-laranja))]"
                : "bg-white text-slate-400 ring-slate-200"
            }`}
          >
            {p.done ? "✓" : i + 1}
          </span>
          <span className={p.done ? "font-medium text-slate-700" : "text-slate-400"}>
            {p.label}
          </span>
          {i < passos.length - 1 && (
            <span
              className={`mx-1 h-px flex-1 ${passos[i + 1]?.done ? "bg-[rgb(var(--ifp-laranja))]" : "bg-slate-200"}`}
            />
          )}
        </li>
      ))}
    </ol>
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

  const inputCls =
    "w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[rgb(var(--ifp-laranja))] focus:ring-2 focus:ring-[rgb(var(--ifp-laranja))]/20 disabled:bg-slate-50 disabled:text-[rgb(var(--ifp-muted))]";

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <Jornada triagem={triagem} />
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-[rgb(var(--ifp-laranja))]/8 to-transparent px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="h-8 w-1 rounded-full bg-[rgb(var(--ifp-laranja))]" aria-hidden />
            <h2 className="text-base font-semibold tracking-tight text-[rgb(var(--ifp-ink))]">
              Entrevista
            </h2>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
              concluida
                ? "bg-violet-50 text-violet-700 ring-violet-200"
                : "bg-emerald-50 text-emerald-700 ring-emerald-200"
            }`}
          >
            {concluida ? "Concluída" : "Aberta"}
          </span>
        </div>

        <div className="grid gap-5 px-6 py-6">
          <div className="max-w-xs">
            <label
              htmlFor="data-entrevista"
              className="mb-1.5 block text-xs font-semibold tracking-wide text-[rgb(var(--ifp-muted))] uppercase"
            >
              Data da entrevista
            </label>
            <input
              id="data-entrevista"
              type="date"
              value={dataEntrevista}
              disabled={concluida}
              onChange={(e) => setDataEntrevista(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label
              htmlFor="parecer"
              className="mb-1.5 block text-xs font-semibold tracking-wide text-[rgb(var(--ifp-muted))] uppercase"
            >
              Parecer
            </label>
            <textarea
              id="parecer"
              rows={4}
              value={parecer}
              disabled={concluida}
              onChange={(e) => setParecer(e.target.value)}
              placeholder="Avaliação socioeconômica e parecer da assistente social"
              className={inputCls}
            />
          </div>
          <div>
            <label
              htmlFor="observacoes"
              className="mb-1.5 block text-xs font-semibold tracking-wide text-[rgb(var(--ifp-muted))] uppercase"
            >
              Observações
            </label>
            <textarea
              id="observacoes"
              rows={3}
              value={observacoes}
              disabled={concluida}
              onChange={(e) => setObservacoes(e.target.value)}
              className={inputCls}
            />
          </div>

          {!concluida && (
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                onClick={salvar}
                disabled={saving}
                className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
              >
                {saving ? "Salvando…" : "Salvar entrevista"}
              </button>
              <button
                onClick={concluir}
                disabled={closing}
                className="rounded-full bg-[rgb(var(--ifp-laranja))] px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[rgb(var(--ifp-laranja))]/30 transition hover:-translate-y-0.5 hover:shadow-md disabled:translate-y-0 disabled:opacity-60"
              >
                {closing ? "Concluindo…" : "Concluir triagem"}
              </button>
              {msg && <p className="text-sm text-[rgb(var(--ifp-muted))]">{msg}</p>}
            </div>
          )}
          {concluida && msg && <p className="text-sm text-[rgb(var(--ifp-muted))]">{msg}</p>}
        </div>
      </section>

      <ElegibilidadeGrid triagem={triagem} />
    </div>
  );
}

function ElegibilidadeGrid({ triagem }: { triagem: TriagemData }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-4">
        <h2 className="text-base font-semibold tracking-tight text-[rgb(var(--ifp-ink))]">
          Elegibilidade por unidade
        </h2>
        <p className="mt-1 text-xs text-[rgb(var(--ifp-muted))]">
          Decisão manual da assistente social. Aprovar ao menos uma unidade ativa o cadastro.
        </p>
      </div>
      <div className="divide-y divide-slate-100">
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
      className="relative flex flex-wrap items-center gap-3 px-6 py-4 transition hover:bg-slate-50/60"
    >
      <span
        className="absolute top-0 bottom-0 left-0 w-1"
        style={{ background: `rgb(var(--ifp-${unidadeValue}))` }}
        aria-hidden
      />
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ background: `rgb(var(--ifp-${unidadeValue}))` }}
        aria-hidden
      />
      <span className="w-40 text-sm font-semibold text-slate-800">{unidadeLabel}</span>
      <span
        className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ${STATUS_BADGE[statusInicial]}`}
      >
        {statusInicial}
      </span>
      <select
        aria-label={`Status ${unidadeLabel}`}
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 outline-none focus:border-[rgb(var(--ifp-laranja))] focus:ring-2 focus:ring-[rgb(var(--ifp-laranja))]/20"
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
        className="min-w-[160px] flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none placeholder:text-slate-400 focus:border-[rgb(var(--ifp-laranja))] focus:ring-2 focus:ring-[rgb(var(--ifp-laranja))]/20"
      />
      <button
        onClick={salvar}
        disabled={pending}
        className="rounded-full border border-slate-200 px-4 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white disabled:opacity-60"
      >
        {pending ? "…" : "Salvar"}
      </button>
      {erro && <p className="w-full pl-4 text-xs text-rose-600">{erro}</p>}
    </div>
  );
}
