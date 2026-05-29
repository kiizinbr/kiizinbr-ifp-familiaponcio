"use client";

import { useState, useTransition } from "react";
import { criarVagaAndRedirect } from "./actions";

const INPUT =
  "w-full rounded-lg border border-black/10 px-3.5 py-2.5 text-sm outline-none transition focus:border-[rgb(var(--ifp-orange-500))] focus:ring-2 focus:ring-[rgb(var(--ifp-orange-500))]/20";
const LABEL =
  "mb-1.5 block text-xs font-semibold tracking-wide text-[rgb(var(--ifp-muted))] uppercase";

export function VagaForm({ unidades }: { unidades: { value: string; label: string }[] }) {
  const [unidade, setUnidade] = useState(unidades[0]?.value ?? "");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [slotsTotais, setSlotsTotais] = useState("10");
  const [abreEm, setAbreEm] = useState("");
  const [fechaEm, setFechaEm] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    start(async () => {
      const r = await criarVagaAndRedirect({
        unidade,
        titulo,
        descricao,
        slotsTotais: Number(slotsTotais),
        abreEm: abreEm || undefined,
        fechaEm: fechaEm || undefined,
      });
      if (r && !r.ok) setErro(r.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="ifp-card max-w-2xl space-y-5 p-7">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="unidade" className={LABEL}>
            Unidade
          </label>
          <select
            id="unidade"
            value={unidade}
            onChange={(e) => setUnidade(e.target.value)}
            className={INPUT}
          >
            {unidades.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="slots" className={LABEL}>
            Slots (capacidade)
          </label>
          <input
            id="slots"
            type="number"
            min={1}
            value={slotsTotais}
            onChange={(e) => setSlotsTotais(e.target.value)}
            className={INPUT}
          />
        </div>
      </div>

      <div>
        <label htmlFor="titulo" className={LABEL}>
          Título da vaga
        </label>
        <input
          id="titulo"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Ex: Turma de informática básica — manhã"
          className={INPUT}
        />
      </div>

      <div>
        <label htmlFor="descricao" className={LABEL}>
          Descrição (opcional)
        </label>
        <textarea
          id="descricao"
          rows={3}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          className={INPUT}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="abre" className={LABEL}>
            Abre em (opcional)
          </label>
          <input
            id="abre"
            type="date"
            value={abreEm}
            onChange={(e) => setAbreEm(e.target.value)}
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="fecha" className={LABEL}>
            Fecha em (opcional)
          </label>
          <input
            id="fecha"
            type="date"
            value={fechaEm}
            onChange={(e) => setFechaEm(e.target.value)}
            className={INPUT}
          />
        </div>
      </div>

      {erro && <p className="text-sm text-rose-600">{erro}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-[rgb(var(--ifp-orange-500))] px-6 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
      >
        {pending ? "Criando…" : "Criar vaga"}
      </button>
    </form>
  );
}
