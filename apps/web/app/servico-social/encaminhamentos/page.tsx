"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Plus, Search, X } from "lucide-react";

import {
  PRIORIDADE_SINAL_LABEL,
  STATUS_ENCAMINHAMENTO_LABEL,
  UNIDADES,
  asOptions,
  type Encaminhamento,
  type PrioridadeSinal,
  type StatusEncaminhamento,
} from "@/lib/api";
import {
  useAceitarEncaminhamento,
  useCriarEncaminhamento,
  useEncaminhamentos,
  useRecusarEncaminhamento,
} from "@/lib/use-encaminhamentos";
import { useFichas } from "@/lib/use-fichas";
import { formatDataHora } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Alerta, Botao, Campo, Input, Select, Spinner, Textarea } from "@/components/ui";
import { Card, Kpi, PageHeader } from "@/components/casa";

const PER_PAGE = 20;
const prioridadeOptions = asOptions(PRIORIDADE_SINAL_LABEL);

const TABS: { key: StatusEncaminhamento; label: string }[] = [
  { key: "PENDENTE", label: "Pendentes" },
  { key: "ACEITO", label: "Aceitos" },
  { key: "RECUSADO", label: "Recusados" },
];

const PRIORIDADE_ESTILO: Record<PrioridadeSinal, string> = {
  NORMAL: "border-border text-muted-foreground",
  URGENTE: "border-danger/40 bg-danger/10 text-danger",
};
const STATUS_ESTILO: Record<StatusEncaminhamento, string> = {
  PENDENTE: "border-border text-muted-foreground",
  ACEITO: "border-success/40 bg-success/10 text-success",
  RECUSADO: "border-danger/40 bg-danger/10 text-danger",
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
// Ações de um encaminhamento pendente: Aceitar / Recusar (c/ justificativa)
// ------------------------------------------------------------
function AcoesEncaminhamento({ enc }: { enc: Encaminhamento }) {
  const aceitar = useAceitarEncaminhamento();
  const recusar = useRecusarEncaminhamento();
  const [recusando, setRecusando] = useState(false);
  const [justificativa, setJustificativa] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  async function confirmarRecusa() {
    setErro(null);
    if (justificativa.trim().length < 3) {
      setErro("Explique o motivo da recusa (mín. 3 caracteres).");
      return;
    }
    try {
      await recusar.mutateAsync({ id: enc.id, justificativaResposta: justificativa.trim() });
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  async function confirmarAceite() {
    setErro(null);
    try {
      await aceitar.mutateAsync(enc.id);
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  if (recusando) {
    return (
      <div className="mt-3 rounded-md border border-border p-3">
        <Campo label="Justificativa da recusa">
          <Textarea
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            rows={2}
            autoFocus
            placeholder="Por que este encaminhamento não pode ser aceito?"
          />
        </Campo>
        <div className="mt-2 flex items-center gap-2">
          <Botao variante="danger" onClick={confirmarRecusa} carregando={recusar.isPending}>
            Confirmar recusa
          </Botao>
          <Botao
            variante="ghost"
            onClick={() => {
              setRecusando(false);
              setErro(null);
            }}
          >
            Cancelar
          </Botao>
          {erro ? <span className="text-xs text-danger">{erro}</span> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        <Botao variante="outline" onClick={() => setRecusando(true)}>
          Recusar
        </Botao>
        <Botao onClick={confirmarAceite} carregando={aceitar.isPending}>
          Aceitar
        </Botao>
      </div>
      {erro ? <span className="text-xs text-danger">{erro}</span> : null}
    </div>
  );
}

// ------------------------------------------------------------
// Painel "Novo encaminhamento"
// ------------------------------------------------------------
function NovoEncaminhamentoPanel({ onClose }: { onClose: () => void }) {
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [fichaId, setFichaId] = useState<string | null>(null);
  const [fichaNome, setFichaNome] = useState("");
  const [origem, setOrigem] = useState(UNIDADES[0]?.slug ?? "");
  const [destino, setDestino] = useState(UNIDADES[1]?.slug ?? "");
  const [prioridade, setPrioridade] = useState<PrioridadeSinal>("NORMAL");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const criar = useCriarEncaminhamento();

  useEffect(() => {
    const t = setTimeout(() => setQ(qInput), 350);
    return () => clearTimeout(t);
  }, [qInput]);

  const { data: fichas, isFetching } = useFichas({ q, perPage: 6 });
  const mostrarResultados = !fichaId && q.trim().length >= 2;

  async function enviar() {
    setErro(null);
    if (!fichaId) return;
    if (origem === destino) {
      setErro("Origem e destino devem ser unidades diferentes.");
      return;
    }
    if (motivo.trim().length < 3) {
      setErro("Descreva o motivo do encaminhamento (mín. 3 caracteres).");
      return;
    }
    try {
      await criar.mutateAsync({
        fichaId,
        unidadeOrigemSlug: origem,
        unidadeDestinoSlug: destino,
        prioridade,
        motivo: motivo.trim(),
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
          Novo encaminhamento
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

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Campo label="Origem (unidade aprovada)">
          <Select value={origem} onChange={(e) => setOrigem(e.target.value)}>
            {UNIDADES.map((u) => (
              <option key={u.slug} value={u.slug}>
                {u.nome}
              </option>
            ))}
          </Select>
        </Campo>
        <Campo label="Destino">
          <Select value={destino} onChange={(e) => setDestino(e.target.value)}>
            {UNIDADES.map((u) => (
              <option key={u.slug} value={u.slug}>
                {u.nome}
              </option>
            ))}
          </Select>
        </Campo>
        <Campo label="Prioridade">
          <Select value={prioridade} onChange={(e) => setPrioridade(e.target.value as PrioridadeSinal)}>
            {prioridadeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Campo>
      </div>
      <Campo label="Motivo" className="mt-3">
        <Textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="Por que esta família está sendo encaminhada?"
        />
      </Campo>

      <div className="mt-4 flex items-center gap-3">
        <Botao type="button" onClick={enviar} carregando={criar.isPending} disabled={!fichaId}>
          <Plus className="h-4 w-4" />
          Encaminhar
        </Botao>
        {erro ? <span className="text-xs text-danger">{erro}</span> : null}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        A família precisa estar <strong>aprovada na unidade de origem</strong>.
      </p>
    </div>
  );
}

// ------------------------------------------------------------
// Página
// ------------------------------------------------------------
export default function EncaminhamentosPage() {
  const [tab, setTab] = useState<StatusEncaminhamento>("PENDENTE");
  const [page, setPage] = useState(1);
  const [novoAberto, setNovoAberto] = useState(false);

  const { data, isLoading, isError, error, isFetching } = useEncaminhamentos({
    status: tab,
    page,
    perPage: PER_PAGE,
  });

  const kpis = data?.kpis;
  const totalPages = data?.pagination.totalPages ?? 1;
  const total = data?.pagination.total ?? 0;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <PageHeader
        titulo="Encaminhamentos"
        descricao="Famílias encaminhadas entre as unidades — aceite ou recuse cada solicitação."
        acoes={
          <Botao onClick={() => setNovoAberto((v) => !v)}>
            <Plus className="h-4 w-4" />
            Novo encaminhamento
          </Botao>
        }
      />

      {/* KPIs */}
      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Pendentes" valor={kpis?.pendentes ?? "—"} alerta={!!kpis && kpis.pendentes > 0} />
        <Kpi label="Aceitos (7d)" valor={kpis?.aceitosSemana ?? "—"} />
        <Kpi label="Tempo médio" valor={kpis ? `${kpis.tempoMedioDias}d` : "—"} />
        <Kpi label="Recusados (30d)" valor={kpis?.recusadosMes ?? "—"} />
      </section>

      {novoAberto ? <NovoEncaminhamentoPanel onClose={() => setNovoAberto(false)} /> : null}

      {/* Abas */}
      <div className="mb-6 flex gap-2 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key);
              setPage(1);
            }}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition",
              tab === t.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {isLoading ? (
        <Spinner label="Carregando encaminhamentos..." />
      ) : isError ? (
        <Alerta>
          Não foi possível carregar: {(error as Error)?.message ?? "erro desconhecido"}
        </Alerta>
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">Nenhum encaminhamento {TABS.find((t) => t.key === tab)?.label.toLowerCase()}.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {data.items.map((enc) => (
              <Card key={enc.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                      <span>{enc.unidadeOrigem.nome}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <span>{enc.unidadeDestino.nome}</span>
                    </div>
                    <Link
                      href={`/servico-social/fichas/${enc.fichaId}`}
                      className="mt-1 inline-block text-sm text-muted-foreground hover:text-primary"
                    >
                      {enc.ficha.nomeCompleto} · {enc.ficha.protocolo}
                    </Link>
                    <p className="mt-2 text-sm text-foreground">{enc.motivo}</p>
                    {enc.justificativaResposta ? (
                      <p className="mt-1 text-xs text-danger">
                        Recusado: {enc.justificativaResposta}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-muted-foreground">
                      Aberto em {formatDataHora(enc.criadoEm)}
                      {enc.respondidoEm ? ` · respondido em ${formatDataHora(enc.respondidoEm)}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                      <Pilula className={PRIORIDADE_ESTILO[enc.prioridade]}>
                        {enc.prioridade === "URGENTE" ? (
                          <AlertTriangle className="mr-1 h-3 w-3" />
                        ) : null}
                        {PRIORIDADE_SINAL_LABEL[enc.prioridade]}
                      </Pilula>
                      <Pilula className={STATUS_ESTILO[enc.status]}>
                        {STATUS_ENCAMINHAMENTO_LABEL[enc.status]}
                      </Pilula>
                    </div>
                    {enc.status === "PENDENTE" ? <AcoesEncaminhamento enc={enc} /> : null}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Paginação */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {total} no total · página {page} de {totalPages}
              {isFetching ? " · atualizando..." : ""}
            </p>
            <div className="flex gap-2">
              <Botao variante="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Anterior
              </Botao>
              <Botao variante="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Próxima
              </Botao>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
