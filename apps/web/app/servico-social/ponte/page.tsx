"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, Inbox } from "lucide-react";

import {
  PRIORIDADE_SINAL_LABEL,
  TIPO_SINALIZACAO_LABEL,
  type PrioridadeSinal,
  type SinalizacaoPonte,
  type StatusSinalizacao,
  type TipoSinalizacao,
} from "@/lib/api";
import { useMarcarAtendida, usePonte } from "@/lib/use-ponte";
import { formatDataHora } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Alerta, Botao, Spinner } from "@/components/ui";
import { Card, Kpi, PageHeader } from "@/components/casa";

const PER_PAGE = 20;

const TABS: { key: StatusSinalizacao; label: string }[] = [
  { key: "PENDENTE", label: "Pendentes" },
  { key: "ATENDIDA", label: "Atendidas" },
];

const PRIORIDADE_ESTILO: Record<PrioridadeSinal, string> = {
  NORMAL: "border-border text-muted-foreground",
  URGENTE: "border-danger/40 bg-danger/10 text-danger",
};
const TIPO_ESTILO: Record<TipoSinalizacao, string> = {
  ENCAMINHAMENTO: "border-primary/40 bg-primary/10 text-primary",
  OBSERVACAO: "border-border text-muted-foreground",
  ALERTA: "border-warning/40 bg-warning/10 text-warning",
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

function AcaoAtender({ sinal }: { sinal: SinalizacaoPonte }) {
  const marcar = useMarcarAtendida();
  const [erro, setErro] = useState<string | null>(null);

  async function atender() {
    setErro(null);
    try {
      await marcar.mutateAsync(sinal.id);
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Botao onClick={atender} carregando={marcar.isPending}>
        <Check className="h-4 w-4" />
        Atender
      </Botao>
      {erro ? <span className="text-xs text-danger">{erro}</span> : null}
    </div>
  );
}

export default function PontePage() {
  const [tab, setTab] = useState<StatusSinalizacao>("PENDENTE");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, isFetching } = usePonte({
    status: tab,
    page,
    perPage: PER_PAGE,
  });

  const kpis = data?.kpis;
  const totalPages = data?.pagination.totalPages ?? 1;
  const total = data?.pagination.total ?? 0;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <PageHeader
        titulo="Ponte"
        descricao="Sinalizações que os profissionais das unidades enviam ao Serviço Social."
      />

      {/* KPIs */}
      <section className="mb-6 grid gap-4 sm:grid-cols-2">
        <Kpi label="Pendentes" valor={kpis?.pendentes ?? "—"} alerta={!!kpis && kpis.pendentes > 0} />
        <Kpi label="Urgentes" valor={kpis?.urgentes ?? "—"} alerta={!!kpis && kpis.urgentes > 0} />
      </section>

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
        <Spinner label="Carregando sinalizações..." />
      ) : isError ? (
        <Alerta>Não foi possível carregar: {(error as Error)?.message ?? "erro desconhecido"}</Alerta>
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <Inbox className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            {tab === "PENDENTE" ? "Nenhuma sinalização pendente." : "Nenhuma sinalização atendida ainda."}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {data.items.map((s) => (
              <Card key={s.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pilula className={TIPO_ESTILO[s.tipo]}>{TIPO_SINALIZACAO_LABEL[s.tipo]}</Pilula>
                      <Pilula className={PRIORIDADE_ESTILO[s.prioridade]}>
                        {s.prioridade === "URGENTE" ? <AlertTriangle className="mr-1 h-3 w-3" /> : null}
                        {PRIORIDADE_SINAL_LABEL[s.prioridade]}
                      </Pilula>
                      <span className="text-xs text-muted-foreground">de {s.unidadeOrigem.nome}</span>
                    </div>
                    <p className="mt-2 text-sm text-foreground">{s.descricao}</p>
                    <Link
                      href={`/servico-social/fichas/${s.fichaId}`}
                      className="mt-1 inline-block text-sm text-muted-foreground hover:text-primary"
                    >
                      {s.ficha.nomeCompleto}
                      {s.membro ? ` · sobre ${s.membro.nomeCompleto}` : ""} · {s.ficha.protocolo}
                    </Link>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatDataHora(s.criadoEm)}
                      {s.respondidoEm ? ` · atendida em ${formatDataHora(s.respondidoEm)}` : ""}
                    </p>
                  </div>
                  {s.status === "PENDENTE" ? <AcaoAtender sinal={s} /> : null}
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
