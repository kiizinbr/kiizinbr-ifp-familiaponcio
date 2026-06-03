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
  pendente: "badge-default",
  aprovado: "badge-success",
  negado: "badge-danger",
  encaminhado: "badge-warning",
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
        className="btn btn-primary"
      >
        {pending ? "Abrindo…" : "Abrir triagem"}
        <span aria-hidden>→</span>
      </button>
      {erro && <p className="mt-2 text-sm text-[var(--danger)]">{erro}</p>}
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
    <ol className="stepper">
      {passos.map((p, i) => (
        <li key={p.label} className={`step${p.done ? "done" : ""}`}>
          <span className="num">{p.done ? "✓" : i + 1}</span>
          <span className="lbl">{p.label}</span>
          {i < passos.length - 1 && (
            <span
              className="bar"
              style={passos[i + 1]?.done ? { background: "var(--accent)" } : undefined}
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

  return (
    <div className="space-y-6">
      <div className="card px-5 py-4">
        <Jornada triagem={triagem} />
      </div>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--line)] bg-[linear-gradient(90deg,var(--accent-soft),transparent)] px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="h-8 w-1 rounded-full bg-[var(--accent)]" aria-hidden />
            <h2 className="t-h3 text-[var(--text)]">Entrevista</h2>
          </div>
          <span className={`badge ${concluida ? "badge-info" : "badge-success"}`}>
            {concluida ? "Concluída" : "Aberta"}
          </span>
        </div>

        <div className="grid gap-5 px-6 py-6">
          <label htmlFor="data-entrevista" className="field-group max-w-xs">
            <span className="micro">Data da entrevista</span>
            <input
              id="data-entrevista"
              type="date"
              value={dataEntrevista}
              disabled={concluida}
              onChange={(e) => setDataEntrevista(e.target.value)}
              className="input"
            />
          </label>
          <label htmlFor="parecer" className="field-group">
            <span className="micro">Parecer</span>
            <textarea
              id="parecer"
              rows={4}
              value={parecer}
              disabled={concluida}
              onChange={(e) => setParecer(e.target.value)}
              placeholder="Avaliação socioeconômica e parecer da assistente social"
              className="textarea"
            />
          </label>
          <label htmlFor="observacoes" className="field-group">
            <span className="micro">Observações</span>
            <textarea
              id="observacoes"
              rows={3}
              value={observacoes}
              disabled={concluida}
              onChange={(e) => setObservacoes(e.target.value)}
              className="textarea"
            />
          </label>

          {!concluida && (
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button onClick={salvar} disabled={saving} className="btn btn-secondary">
                {saving ? "Salvando…" : "Salvar entrevista"}
              </button>
              <button onClick={concluir} disabled={closing} className="btn btn-primary">
                {closing ? "Concluindo…" : "Concluir triagem"}
              </button>
              {msg && <p className="text-sm text-[var(--text-3)]">{msg}</p>}
            </div>
          )}
          {concluida && msg && <p className="text-sm text-[var(--text-3)]">{msg}</p>}
        </div>
      </section>

      <ElegibilidadeGrid triagem={triagem} />
    </div>
  );
}

function ElegibilidadeGrid({ triagem }: { triagem: TriagemData }) {
  return (
    <section className="card overflow-hidden">
      <div className="border-b border-[var(--line)] px-6 py-4">
        <h2 className="t-h3 text-[var(--text)]">Elegibilidade por unidade</h2>
        <p className="mt-1 text-xs text-[var(--text-3)]">
          Decisão manual da assistente social. Aprovar ao menos uma unidade ativa o cadastro.
        </p>
      </div>
      <div className="divide-y divide-[var(--line)]">
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
      className="relative flex flex-wrap items-center gap-3 px-6 py-4 transition hover:bg-[var(--surface-sunken)]"
    >
      <span
        className="absolute top-0 bottom-0 left-0 w-1"
        style={{ background: `rgb(var(--ifp-filter-${unidadeValue}))` }}
        aria-hidden
      />
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ background: `rgb(var(--ifp-filter-${unidadeValue}))` }}
        aria-hidden
      />
      <span className="w-40 text-sm font-semibold text-[var(--text)]">{unidadeLabel}</span>
      <span className={`badge capitalize ${STATUS_BADGE[statusInicial]}`}>{statusInicial}</span>
      <select
        aria-label={`Status ${unidadeLabel}`}
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="select w-auto"
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
        className="input min-w-[160px] flex-1"
      />
      <button onClick={salvar} disabled={pending} className="btn btn-secondary btn-sm">
        {pending ? "…" : "Salvar"}
      </button>
      {erro && <p className="w-full pl-4 text-xs text-[var(--danger)]">{erro}</p>}
    </div>
  );
}
