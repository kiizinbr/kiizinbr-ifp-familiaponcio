"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Search, X } from "lucide-react";

import {
  STATUS_LABEL,
  UNIDADES,
  asOptions,
  type Elegibilidade,
  type StatusElegibilidade,
} from "@/lib/api";
import { useFichas, useUpdateElegibilidade } from "@/lib/use-fichas";
import { formatCpf, formatDataHora } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Alerta, Botao, Campo, Input, Select, Spinner, Textarea } from "@/components/ui";
import { CoroaSeal, PageHeader } from "@/components/casa";

const PER_PAGE = 15;
const statusOptions = asOptions(STATUS_LABEL);

/** Nome curto das unidades para caber nas colunas da matriz. */
const UNIDADE_CURTO: Record<string, string> = {
  medico: "Médico",
  capacitacao: "Capacitação",
  esportivo: "Esportivo",
  educacional: "Educacional",
};

/** Status que "revogam" o acesso → exigem motivo (trilha LGPD/auditoria). */
const STATUS_EXIGE_MOTIVO: StatusElegibilidade[] = ["REPROVADO", "SUSPENSO", "DESLIGADO"];

/** Mapeia o status de elegibilidade para a variante visual da coroa. */
function coroaDe(status: StatusElegibilidade): "aprovado" | "analise" | "bloqueado" {
  if (status === "APROVADO") return "aprovado";
  if (status === "PENDENTE") return "analise";
  return "bloqueado"; // REPROVADO / SUSPENSO / DESLIGADO
}

interface CelulaSelecionada {
  fichaId: string;
  fichaNome: string;
  unidadeSlug: string;
  unidadeNome: string;
  atual?: Elegibilidade;
}

// ------------------------------------------------------------
// Editor de uma célula (família × unidade) — reusa o PUT existente
// ------------------------------------------------------------
function EditorElegibilidade({
  sel,
  onClose,
}: {
  sel: CelulaSelecionada;
  onClose: () => void;
}) {
  const mutation = useUpdateElegibilidade();
  const [status, setStatus] = useState<StatusElegibilidade>(sel.atual?.status ?? "PENDENTE");
  const [motivo, setMotivo] = useState(sel.atual?.motivo ?? "");
  const [reavaliarEm, setReavaliarEm] = useState(sel.atual?.reavaliarEm?.slice(0, 10) ?? "");
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const exigeMotivo = STATUS_EXIGE_MOTIVO.includes(status);

  async function salvar() {
    setSalvo(false);
    setErro(null);
    if (exigeMotivo && !motivo.trim()) {
      setErro("Informe o motivo ao reprovar, suspender ou desligar (fica registrado na auditoria).");
      return;
    }
    try {
      await mutation.mutateAsync({
        id: sel.fichaId,
        unidadeSlug: sel.unidadeSlug,
        dados: {
          status,
          ...(motivo.trim() ? { motivo: motivo.trim() } : {}),
          ...(reavaliarEm ? { reavaliarEm } : {}),
        },
      });
      setSalvo(true);
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <div className="mb-6 rounded-[18px] border border-border bg-surface p-5 shadow-[var(--ifp-shadow-casa-sm)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.06em] text-foreground">
            {sel.unidadeNome}
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{sel.fichaNome}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="rounded-md p-1 text-muted-foreground transition hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value as StatusElegibilidade)}>
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Campo>
        <Campo label="Reavaliar em">
          <Input type="date" value={reavaliarEm} onChange={(e) => setReavaliarEm(e.target.value)} />
        </Campo>
      </div>
      <Campo
        label={exigeMotivo ? "Motivo (obrigatório)" : "Motivo / observação"}
        className="mt-3"
      >
        <Textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={2}
          placeholder={
            exigeMotivo
              ? "Por que o acesso está sendo negado/suspenso?"
              : "Opcional — contexto da decisão."
          }
        />
      </Campo>

      <div className="mt-4 flex items-center gap-3">
        <Botao type="button" onClick={salvar} carregando={mutation.isPending}>
          Salvar elegibilidade
        </Botao>
        {salvo && !mutation.isPending ? (
          <span className="inline-flex items-center gap-1 text-xs text-success">
            <Check className="h-3.5 w-3.5" /> salvo
          </span>
        ) : null}
        {erro ? <span className="text-xs text-danger">{erro}</span> : null}
      </div>
      {sel.atual?.avaliadoEm ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Última avaliação: {formatDataHora(sel.atual.avaliadoEm)}
        </p>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------
// Célula da matriz: a coroa (ou "avaliar") clicável
// ------------------------------------------------------------
function CelulaUnidade({
  atual,
  ativa,
  onClick,
}: {
  atual?: Elegibilidade;
  ativa: boolean;
  onClick: () => void;
}) {
  return (
    <td className="px-3 py-2 text-center">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex min-w-[7rem] items-center justify-center rounded-full px-1 py-1 transition",
          ativa ? "ring-2 ring-primary ring-offset-1" : "hover:opacity-80",
        )}
      >
        {atual ? (
          <CoroaSeal status={coroaDe(atual.status)}>{STATUS_LABEL[atual.status]}</CoroaSeal>
        ) : (
          <span className="rounded-full border border-dashed border-border px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
            avaliar
          </span>
        )}
      </button>
    </td>
  );
}

// ------------------------------------------------------------
// Página: matriz de elegibilidade família × unidade
// ------------------------------------------------------------
export default function ElegibilidadePage() {
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState<CelulaSelecionada | null>(null);

  // Debounce da busca (mesmo padrão da listagem de fichas).
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(qInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [qInput]);

  const { data, isLoading, isError, error, isFetching } = useFichas({ page, perPage: PER_PAGE, q });

  const totalPages = data?.pagination.totalPages ?? 1;
  const total = data?.pagination.total ?? 0;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <PageHeader
        titulo="Elegibilidade"
        descricao="Conceda ou revogue o acesso de cada família às unidades — a coroa acende quando a unidade passa a enxergar o beneficiário."
      />

      {/* Busca */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Buscar família por nome, CPF ou protocolo..."
            className="pl-9"
            aria-label="Buscar família"
          />
        </div>
      </div>

      {/* Editor da célula selecionada */}
      {sel ? (
        <EditorElegibilidade
          key={`${sel.fichaId}:${sel.unidadeSlug}`}
          sel={sel}
          onClose={() => setSel(null)}
        />
      ) : null}

      {/* Matriz */}
      {isLoading ? (
        <Spinner label="Carregando famílias..." />
      ) : isError ? (
        <Alerta>
          Não foi possível carregar as famílias: {(error as Error)?.message ?? "erro desconhecido"}
        </Alerta>
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">
            {q ? "Nenhuma família encontrada." : "Nenhuma ficha cadastrada ainda."}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-[18px] border border-border bg-surface shadow-[var(--ifp-shadow-casa-sm)]">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Família
                  </th>
                  {UNIDADES.map((u) => (
                    <th
                      key={u.slug}
                      scope="col"
                      className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                    >
                      {UNIDADE_CURTO[u.slug] ?? u.nome}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map((f) => {
                  const porSlug = new Map(f.elegibilidades.map((e) => [e.unidade.slug, e]));
                  return (
                    <tr key={f.id} className="border-b border-border last:border-0">
                      <th scope="row" className="px-4 py-3 text-left font-normal">
                        <Link
                          href={`/servico-social/fichas/${f.id}`}
                          className="font-semibold text-foreground hover:text-primary"
                        >
                          {f.nomeCompleto}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {f.protocolo} · CPF {formatCpf(f.cpf)}
                        </div>
                      </th>
                      {UNIDADES.map((u) => {
                        const atual = porSlug.get(u.slug);
                        const ativa = sel?.fichaId === f.id && sel?.unidadeSlug === u.slug;
                        return (
                          <CelulaUnidade
                            key={u.slug}
                            atual={atual}
                            ativa={ativa}
                            onClick={() =>
                              setSel({
                                fichaId: f.id,
                                fichaNome: f.nomeCompleto,
                                unidadeSlug: u.slug,
                                unidadeNome: u.nome,
                                atual,
                              })
                            }
                          />
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {total} família(s) · página {page} de {totalPages}
              {isFetching ? " · atualizando..." : ""}
            </p>
            <div className="flex gap-2">
              <Botao
                variante="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Botao>
              <Botao
                variante="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Botao>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
