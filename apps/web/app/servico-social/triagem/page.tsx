"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  ListChecks,
  Play,
  Plus,
  Search,
  X,
} from "lucide-react";

import {
  PRIORIDADE_TRIAGEM_LABEL,
  STATUS_TRIAGEM_LABEL,
  asOptions,
  type PrioridadeTriagem,
  type StatusTriagem,
  type TriagemListaItem,
} from "@/lib/api";
import {
  useConcluirTriagem,
  useCriarTriagem,
  useIniciarTriagem,
  useTriagens,
  type TriagensQuery,
} from "@/lib/use-triagem";
import { useFichas } from "@/lib/use-fichas";
import { iniciaisDe } from "@/lib/iniciais";
import { cn } from "@/lib/cn";
import { Alerta, Botao, Campo, Input, Select, Spinner, Textarea } from "@/components/ui";
import { Kpi, ListRow, PageHeader } from "@/components/casa";

const PER_PAGE = 20;
const ALERTA_ESPERA_DIAS = 7; // a partir daqui o KPI de espera fica em alerta
const statusOptions = asOptions(STATUS_TRIAGEM_LABEL);
const prioridadeOptions = asOptions(PRIORIDADE_TRIAGEM_LABEL);

// ------------------------------------------------------------
// Pílulas de prioridade e status (mesma linguagem visual do CASA)
// ------------------------------------------------------------
const PRIORIDADE_ESTILO: Record<PrioridadeTriagem, string> = {
  BAIXA: "border-border text-muted-foreground",
  MEDIA: "border-border text-foreground",
  ALTA: "border-warning/40 bg-warning/10 text-warning",
  URGENTE: "border-danger/40 bg-danger/10 text-danger",
};

const STATUS_ESTILO: Record<StatusTriagem, string> = {
  PENDENTE: "border-border text-muted-foreground",
  EM_ANDAMENTO: "border-primary/40 bg-primary/10 text-primary",
  CONCLUIDA: "border-success/40 bg-success/10 text-success",
};

function Pilula({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        className,
      )}
    >
      {children}
    </span>
  );
}

// ------------------------------------------------------------
// Ações de cada triagem (transições de status com erro inline)
// ------------------------------------------------------------
function AcoesTriagem({ triagem }: { triagem: TriagemListaItem }) {
  const iniciar = useIniciarTriagem();
  const concluir = useConcluirTriagem();
  const [erro, setErro] = useState<string | null>(null);

  async function rodar(fn: () => Promise<unknown>) {
    setErro(null);
    try {
      await fn();
    } catch (e) {
      // Ex.: 409 quando outra pessoa já mudou o status (a fila recarrega depois).
      setErro((e as Error).message);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        {triagem.status === "PENDENTE" ? (
          <Botao
            variante="outline"
            onClick={() => rodar(() => iniciar.mutateAsync(triagem.id))}
            carregando={iniciar.isPending}
          >
            <Play className="h-4 w-4" />
            Iniciar
          </Botao>
        ) : null}
        {triagem.status === "EM_ANDAMENTO" ? (
          <Botao
            onClick={() => rodar(() => concluir.mutateAsync(triagem.id))}
            carregando={concluir.isPending}
          >
            Concluir
          </Botao>
        ) : null}
        <Link
          href={`/servico-social/fichas/${triagem.fichaId}`}
          className="inline-flex items-center gap-1 rounded-md px-2 py-2 text-sm font-medium text-muted-foreground transition hover:text-primary"
        >
          Ficha
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      {erro ? <span className="text-xs text-danger">{erro}</span> : null}
    </div>
  );
}

// ------------------------------------------------------------
// Painel "Nova triagem": busca uma ficha e abre a triagem na fila
// ------------------------------------------------------------
function NovaTriagemPanel({ onClose }: { onClose: () => void }) {
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [fichaId, setFichaId] = useState<string | null>(null);
  const [fichaNome, setFichaNome] = useState("");
  const [prioridade, setPrioridade] = useState<PrioridadeTriagem>("MEDIA");
  const [motivo, setMotivo] = useState("");

  const criar = useCriarTriagem();
  const [erro, setErro] = useState<string | null>(null);

  // Debounce da busca de fichas (mesmo padrão da listagem).
  useEffect(() => {
    const t = setTimeout(() => setQ(qInput), 350);
    return () => clearTimeout(t);
  }, [qInput]);

  const { data: fichas, isFetching, isError: erroBusca } = useFichas({ q, perPage: 6 });
  const mostrarResultados = !fichaId && q.trim().length >= 2;

  async function abrir() {
    if (!fichaId) return;
    setErro(null);
    try {
      await criar.mutateAsync({
        fichaId,
        prioridade,
        ...(motivo.trim() ? { motivoSolicitacao: motivo.trim() } : {}),
      });
      onClose();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <div className="mb-6 rounded-[18px] border border-border bg-surface p-5 shadow-[var(--ifp-shadow-casa-sm)]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-[0.06em] text-foreground">
          Nova triagem
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="rounded-md p-1 text-muted-foreground transition hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* 1) Escolher a ficha */}
      {fichaId ? (
        <div className="mb-4 flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
          <span className="text-sm font-medium text-foreground">{fichaNome}</span>
          <button
            type="button"
            onClick={() => {
              setFichaId(null);
              setFichaNome("");
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            trocar
          </button>
        </div>
      ) : (
        <Campo label="Família (busque por nome, CPF ou protocolo)">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Digite ao menos 2 caracteres..."
              className="pl-9"
              aria-label="Buscar ficha"
            />
          </div>
          {mostrarResultados ? (
            <div className="mt-2 overflow-hidden rounded-md border border-border">
              {isFetching && !fichas ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">Buscando...</p>
              ) : erroBusca ? (
                <p className="px-3 py-2 text-xs text-danger">
                  Não foi possível buscar agora — tente de novo.
                </p>
              ) : !fichas || fichas.items.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">Nenhuma ficha encontrada.</p>
              ) : (
                fichas.items.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      setFichaId(f.id);
                      setFichaNome(f.nomeCompleto);
                    }}
                    className="flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left text-sm transition last:border-0 hover:bg-muted"
                  >
                    <span className="font-medium text-foreground">{f.nomeCompleto}</span>
                    <span className="text-xs text-muted-foreground">{f.protocolo}</span>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </Campo>
      )}

      {/* 2) Prioridade + motivo */}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Campo label="Prioridade">
          <Select
            value={prioridade}
            onChange={(e) => setPrioridade(e.target.value as PrioridadeTriagem)}
          >
            {prioridadeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Campo>
      </div>
      <Campo label="Motivo da solicitação (opcional)" className="mt-3">
        <Textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="Ex.: encaminhada pelo CRAS, situação de insegurança alimentar..."
        />
      </Campo>

      <div className="mt-4 flex items-center gap-3">
        <Botao type="button" onClick={abrir} carregando={criar.isPending} disabled={!fichaId}>
          <Plus className="h-4 w-4" />
          Abrir triagem
        </Botao>
        {erro ? <span className="text-xs text-danger">{erro}</span> : null}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Página: fila de triagem do Serviço Social
// ------------------------------------------------------------
export default function TriagemPage() {
  const [status, setStatus] = useState<StatusTriagem | "">("");
  const [prioridade, setPrioridade] = useState<PrioridadeTriagem | "">("");
  const [page, setPage] = useState(1);
  const [novaAberta, setNovaAberta] = useState(false);

  const params: TriagensQuery = { status, prioridade, page, perPage: PER_PAGE };
  const { data, isLoading, isError, error, isFetching } = useTriagens(params);

  const kpis = data?.kpis;
  const totalPages = data?.pagination.totalPages ?? 1;
  const total = data?.pagination.total ?? 0;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <PageHeader
        titulo="Triagem"
        descricao="Fila de famílias aguardando avaliação, ordenada por prioridade."
        acoes={
          <Botao onClick={() => setNovaAberta((v) => !v)} aria-expanded={novaAberta}>
            <Plus className="h-4 w-4" />
            Nova triagem
          </Botao>
        }
      />

      {/* KPIs */}
      <section className="mb-6 grid gap-4 sm:grid-cols-3">
        <Kpi label="Na fila" valor={kpis?.naFila ?? "—"} />
        <Kpi
          label="Prioritárias"
          valor={kpis?.prioritarias ?? "—"}
          alerta={!!kpis && kpis.prioritarias > 0}
        />
        <Kpi
          label="Maior espera"
          valor={kpis ? `${kpis.maiorEsperaDias}d` : "—"}
          alerta={!!kpis && kpis.maiorEsperaDias >= ALERTA_ESPERA_DIAS}
        />
      </section>

      {novaAberta ? <NovaTriagemPanel onClose={() => setNovaAberta(false)} /> : null}

      {/* Filtros */}
      <div className="mb-6 grid gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-[auto_auto_1fr]">
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as StatusTriagem | "");
            setPage(1);
          }}
          aria-label="Filtrar por status"
        >
          <option value="">Todos os status</option>
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select
          value={prioridade}
          onChange={(e) => {
            setPrioridade(e.target.value as PrioridadeTriagem | "");
            setPage(1);
          }}
          aria-label="Filtrar por prioridade"
        >
          <option value="">Todas as prioridades</option>
          {prioridadeOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <Spinner label="Carregando fila..." />
      ) : isError ? (
        <Alerta>
          Não foi possível carregar a fila: {(error as Error)?.message ?? "erro desconhecido"}
        </Alerta>
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <ListChecks className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            {status || prioridade
              ? "Nenhuma triagem com esses filtros."
              : "Nenhuma família na fila de triagem."}
          </p>
        </div>
      ) : (
        <>
          <div>
            {data.items.map((t) => {
              const esperaTom =
                t.status !== "CONCLUIDA" && t.diasEspera >= ALERTA_ESPERA_DIAS
                  ? "text-warning"
                  : "text-muted-foreground";
              return (
                <ListRow
                  key={t.id}
                  avatar={iniciaisDe(t.ficha.nomeCompleto)}
                  titulo={
                    <span className="flex flex-wrap items-center gap-2">
                      {t.ficha.nomeCompleto}
                      <Pilula className={PRIORIDADE_ESTILO[t.prioridade]}>
                        {t.prioridade === "URGENTE" || t.prioridade === "ALTA" ? (
                          <AlertTriangle className="mr-1 h-3 w-3" />
                        ) : null}
                        {PRIORIDADE_TRIAGEM_LABEL[t.prioridade]}
                      </Pilula>
                      <Pilula className={STATUS_ESTILO[t.status]}>
                        {STATUS_TRIAGEM_LABEL[t.status]}
                      </Pilula>
                    </span>
                  }
                  subtitulo={
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      <span>{t.ficha.protocolo}</span>
                      {t.status !== "CONCLUIDA" ? (
                        <span className={cn("inline-flex items-center gap-1", esperaTom)}>
                          <Clock className="h-3 w-3" />
                          {t.diasEspera === 0 ? "hoje" : `${t.diasEspera}d na fila`}
                        </span>
                      ) : null}
                      {t.motivoSolicitacao ? (
                        <span className="truncate text-muted-foreground">· {t.motivoSolicitacao}</span>
                      ) : null}
                    </span>
                  }
                  trailing={<AcoesTriagem triagem={t} />}
                />
              );
            })}
          </div>

          {/* Paginação */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
              {total} na fila · página {page} de {totalPages}
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
