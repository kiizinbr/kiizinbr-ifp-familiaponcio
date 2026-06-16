"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { formatCpf } from "@/lib/cpf";
import { buscarCidadaosAction, criarCidadaoAction } from "./actions";

type Cidadao = { id: string; nome: string; cpf: string; telefone: string };

/**
 * Passo 1 do wizard: busca INCREMENTAL de cidadão (server-side, espelha o combobox
 * da capacitação) + atalho "Novo paciente". Ao escolher/criar alguém, navega o
 * wizard pra ?cidadaoId=<id> e o fluxo continua nos passos seguintes.
 */
export function BuscaCidadaoStep({ queryInicial }: { queryInicial: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(queryInicial);
  const [resultados, setResultados] = useState<Cidadao[]>([]);
  const [buscou, setBuscou] = useState(false);
  const [pending, startTransition] = useTransition();
  const [novoAberto, setNovoAberto] = useState(false);

  function irParaCidadao(id: string) {
    router.push(`/medico/consultas/nova?cidadaoId=${id}` as Route);
  }

  function buscar(q: string) {
    setQuery(q);
    if (q.trim().length < 2) {
      setResultados([]);
      setBuscou(false);
      return;
    }
    startTransition(async () => {
      const r = await buscarCidadaosAction(q);
      setResultados(r);
      setBuscou(true);
    });
  }

  return (
    <div>
      <p className="mb-3 text-sm font-semibold" style={{ color: "var(--text)" }}>
        Quem será atendido?
      </p>

      <div className="flex gap-2">
        <input
          name="q"
          value={query}
          autoFocus
          onChange={(e) => buscar(e.target.value)}
          placeholder="Buscar por nome, CPF ou telefone"
          className="input"
          autoComplete="off"
          aria-label="Buscar cidadão por nome, CPF ou telefone"
        />
        <button
          type="button"
          className="btn btn-ghost shrink-0"
          onClick={() => setNovoAberto((v) => !v)}
        >
          + Novo paciente
        </button>
      </div>

      {pending ? (
        <p className="mt-3 text-sm" style={{ color: "var(--text-3)" }}>
          Buscando…
        </p>
      ) : null}

      {!pending && buscou && resultados.length === 0 && !novoAberto && (
        <p className="mt-4 text-sm" style={{ color: "var(--text-3)" }}>
          Ninguém encontrado para “{query.trim()}”.{" "}
          <button
            type="button"
            className="underline"
            style={{ color: "var(--accent)" }}
            onClick={() => setNovoAberto(true)}
          >
            Cadastrar novo paciente
          </button>
        </p>
      )}

      {resultados.length > 0 && !novoAberto && (
        <ul className="mt-4 divide-y" style={{ borderColor: "var(--line)" }}>
          {resultados.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => irParaCidadao(c.id)}
                className="flex w-full items-center justify-between gap-3 py-3 text-left transition hover:bg-[var(--surface-2)]"
              >
                <span className="font-medium" style={{ color: "var(--text)" }}>
                  {c.nome}
                </span>
                <span className="mono text-xs" style={{ color: "var(--text-3)" }}>
                  {formatCpf(c.cpf)} · {c.telefone}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {novoAberto && (
        <NovoPacienteForm onCriado={irParaCidadao} onCancelar={() => setNovoAberto(false)} />
      )}
    </div>
  );
}

function NovoPacienteForm({
  onCriado,
  onCancelar,
}: {
  onCriado: (id: string) => void;
  onCancelar: () => void;
}) {
  const [erros, setErros] = useState<Record<string, string[]>>({});
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input = {
      nomeCompleto: String(fd.get("nomeCompleto") ?? ""),
      cpf: String(fd.get("cpf") ?? ""),
      dataNascimento: String(fd.get("dataNascimento") ?? ""),
      telefonePrincipal: String(fd.get("telefonePrincipal") ?? ""),
    };
    startTransition(async () => {
      const r = await criarCidadaoAction(input);
      if (r.ok) {
        onCriado(r.id);
      } else {
        setErros(r.errors);
        setMensagem(r.message ?? null);
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-4 rounded-[var(--r-lg)] border p-4"
      style={{ borderColor: "var(--line)", background: "var(--surface)" }}
    >
      <p className="mb-3 text-sm font-bold" style={{ color: "var(--accent)" }}>
        Novo paciente
      </p>

      {mensagem && (
        <p className="mb-3 text-sm" style={{ color: "var(--danger)" }}>
          {mensagem}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label="Nome completo" name="nomeCompleto" erros={erros.nomeCompleto} autoFocus />
        <Campo label="CPF" name="cpf" erros={erros.cpf} placeholder="000.000.000-00" />
        <Campo
          label="Data de nascimento"
          name="dataNascimento"
          type="date"
          erros={erros.dataNascimento}
        />
        <Campo label="Telefone" name="telefonePrincipal" erros={erros.telefonePrincipal} />
      </div>

      <div className="mt-4 flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Salvando…" : "Criar e continuar"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancelar} disabled={pending}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Campo({
  label,
  name,
  erros,
  type = "text",
  placeholder,
  autoFocus,
}: {
  label: string;
  name: string;
  erros?: string[];
  type?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-[12px]" style={{ color: "var(--text-3)" }}>
      {label}
      <input
        name={name}
        type={type}
        required
        autoFocus={autoFocus}
        placeholder={placeholder}
        className="input"
        autoComplete="off"
      />
      {erros?.length ? (
        <span className="text-[11px]" style={{ color: "var(--danger)" }}>
          {erros[0]}
        </span>
      ) : null}
    </label>
  );
}
