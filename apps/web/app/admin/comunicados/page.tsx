"use client";

/**
 * Rastreamento transversal de ENTREGA/LEITURA de comunicados (governança).
 * Só SUPER_ADMIN. Mostra, por comunicado, quantas famílias do público-alvo já
 * confirmaram leitura (cobertura %) — útil para cobrar leitura de avisos críticos.
 */
import { useState } from "react";
import { useSession } from "next-auth/react";
import { AlertTriangle, Bell, CheckCircle2 } from "lucide-react";

import { Alerta, Botao, Spinner } from "@/components/ui";
import { Card, Kpi, PageHeader, Pill } from "@/components/casa";
import { UNIDADES } from "@/lib/api";
import { useComunicadosEntrega } from "@/lib/use-admin";

function corCobertura(pct: number): string {
  if (pct >= 80) return "text-success";
  if (pct >= 40) return "text-warning";
  return "text-danger";
}

function dataCurta(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { dateStyle: "short" });
}

export default function PaginaComunicadosEntrega() {
  const { data: session } = useSession();
  const ehAdmin = session?.perfis?.includes("SUPER_ADMIN") ?? false;

  const [unidade, setUnidade] = useState("");
  const [somenteCriticos, setSomenteCriticos] = useState(false);
  const { data, isLoading, error } = useComunicadosEntrega({
    unidade: unidade || undefined,
    criticos: somenteCriticos,
  });

  if (!ehAdmin) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Alerta tipo="erro">Esta visão de governança é exclusiva do Super Admin.</Alerta>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <PageHeader
        titulo="Entrega de comunicados"
        descricao="Quem leu o quê — cobertura de leitura dos avisos enviados às famílias."
      />

      {data ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Kpi label="Comunicados" valor={data.kpis.total} />
          <Kpi label="Críticos" valor={data.kpis.criticos} alerta={data.kpis.criticos > 0} />
          <Kpi label="Cobertura média" valor={`${data.kpis.coberturaMedia}%`} />
        </div>
      ) : null}

      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2">
            <Botao
              variante={unidade === "" ? "primary" : "outline"}
              onClick={() => setUnidade("")}
            >
              Todas as unidades
            </Botao>
            {UNIDADES.map((u) => (
              <Botao
                key={u.slug}
                variante={unidade === u.slug ? "primary" : "outline"}
                onClick={() => setUnidade(u.slug)}
              >
                {u.nome}
              </Botao>
            ))}
          </div>
          <div className="ml-auto">
            <Botao
              variante={somenteCriticos ? "danger" : "outline"}
              onClick={() => setSomenteCriticos((v) => !v)}
            >
              <AlertTriangle className="h-4 w-4" /> Só críticos
            </Botao>
          </div>
        </div>
      </Card>

      {isLoading ? <Spinner label="Carregando comunicados..." /> : null}
      {error ? <Alerta tipo="erro">{(error as Error).message}</Alerta> : null}

      {data ? (
        <div className="space-y-3">
          {data.items.map((c) => (
            <Card key={c.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Bell className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-foreground">{c.titulo}</span>
                    {c.critico ? <Pill tom="warn">Crítico</Pill> : null}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {c.unidade.nome}
                    {c.turma ? ` · ${c.turma.nome}` : " · Geral"} · {dataCurta(c.criadoEm)}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-semibold tabular-nums ${corCobertura(c.coberturaPct)}`}>
                    {c.coberturaPct}%
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {c.lidos}/{c.publicoAlvo} leram
                  </div>
                </div>
              </div>

              {/* Barra de cobertura */}
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${
                    c.coberturaPct >= 80
                      ? "bg-success"
                      : c.coberturaPct >= 40
                        ? "bg-warning"
                        : "bg-danger"
                  }`}
                  style={{ width: `${c.coberturaPct}%` }}
                />
              </div>
              {c.pendentes > 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">{c.pendentes} família(s) ainda não leram.</p>
              ) : c.publicoAlvo > 0 ? (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Todos leram.
                </p>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">Sem público-alvo cadastrado.</p>
              )}
            </Card>
          ))}
          {data.items.length === 0 ? (
            <Card className="text-center text-sm text-muted-foreground">
              Nenhum comunicado para os filtros selecionados.
            </Card>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
