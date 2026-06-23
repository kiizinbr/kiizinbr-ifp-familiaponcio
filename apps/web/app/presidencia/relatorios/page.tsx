"use client";

/**
 * Relatórios institucionais selados — a Presidência gera um relatório (Prestação
 * de Contas ou Impacto) para um período, ele é REGISTRADO com código/selo e fica
 * disponível para baixar em PDF a qualquer momento. Sem IA: os números são reais
 * e o resumo é determinístico (gerado dos próprios números no backend).
 */
import { useState } from "react";
import { useSession } from "next-auth/react";
import { Download, FileText, ShieldCheck } from "lucide-react";

import { Card, PageHeader, Pill, SecTitle } from "@/components/casa";
import { Alerta, Spinner } from "@/components/ui";
import { API_BASE_URL } from "@/lib/api";
import {
  PERIODO_RELATORIO_LABEL,
  TIPO_RELATORIO_LABEL,
  useGerarRelatorio,
  useRelatorios,
  type PeriodoChave,
  type TipoRelatorio,
} from "@/lib/use-presidencia";

const TIPOS: TipoRelatorio[] = ["PRESTACAO_CONTAS", "IMPACTO"];
const PERIODOS: PeriodoChave[] = ["mes", "ano", "12m"];

function dataBR(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function RelatoriosPage() {
  const { data, isLoading, error } = useRelatorios();
  const gerar = useGerarRelatorio();
  const { data: session } = useSession();

  const [tipo, setTipo] = useState<TipoRelatorio>("PRESTACAO_CONTAS");
  const [periodo, setPeriodo] = useState<PeriodoChave>("12m");
  const [erroGerar, setErroGerar] = useState<string | null>(null);
  const [baixandoId, setBaixandoId] = useState<string | null>(null);
  const [erroPdf, setErroPdf] = useState<string | null>(null);

  async function aoGerar() {
    setErroGerar(null);
    try {
      await gerar.mutateAsync({ tipo, periodo });
    } catch (e) {
      setErroGerar((e as Error).message);
    }
  }

  async function baixar(id: string, codigo: string) {
    setErroPdf(null);
    setBaixandoId(id);
    try {
      const res = await fetch(`${API_BASE_URL}/presidencia/relatorios/${id}/pdf`, {
        headers: { Authorization: `Bearer ${session?.accessToken ?? ""}` },
      });
      if (!res.ok) throw new Error(`Falha ao gerar o PDF (${res.status}).`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio-${codigo}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErroPdf((e as Error).message);
    } finally {
      setBaixandoId(null);
    }
  }

  const itens = data?.itens ?? [];

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <PageHeader
        titulo="Relatórios institucionais"
        descricao="Gere relatórios selados (com código de autenticidade) e baixe em PDF quando precisar."
      />

      {/* Gerar novo relatório */}
      <Card className="mb-8">
        <SecTitle icon={<FileText />}>Gerar novo relatório</SecTitle>

        <div className="mt-2 space-y-4">
          <div>
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Tipo
            </span>
            <div className="flex flex-wrap gap-2">
              {TIPOS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className={
                    tipo === t
                      ? "rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                      : "rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:border-primary/50"
                  }
                >
                  {TIPO_RELATORIO_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Período
            </span>
            <div className="flex flex-wrap gap-2">
              {PERIODOS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriodo(p)}
                  className={
                    periodo === p
                      ? "rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                      : "rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:border-primary/50"
                  }
                >
                  {PERIODO_RELATORIO_LABEL[p]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={aoGerar}
              disabled={gerar.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-ifp-sm transition hover:bg-primary-hover disabled:opacity-60"
            >
              <ShieldCheck className="h-4 w-4" />
              {gerar.isPending ? "Gerando relatório..." : "Gerar e selar"}
            </button>
            {erroGerar ? <span className="text-sm text-danger">{erroGerar}</span> : null}
          </div>
        </div>
      </Card>

      {/* Lista de relatórios gerados */}
      <SecTitle>Relatórios gerados</SecTitle>

      {isLoading ? <Spinner label="Carregando relatórios..." /> : null}
      {error ? <Alerta>{(error as Error).message}</Alerta> : null}
      {erroPdf ? (
        <div className="mb-3">
          <Alerta>{erroPdf}</Alerta>
        </div>
      ) : null}

      {!isLoading && itens.length === 0 ? (
        <Card>
          <p className="text-sm text-muted-foreground">
            Nenhum relatório gerado ainda. Use o painel acima para gerar o primeiro.
          </p>
        </Card>
      ) : null}

      <div className="space-y-3">
        {itens.map((r) => (
          <Card key={r.id} className="flex flex-wrap items-center gap-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--unidade-suave)] text-[var(--unidade-escuro)]">
              <FileText className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-foreground">{r.titulo}</span>
                <Pill tom="ok">{r.codigo}</Pill>
              </div>
              <div className="mt-0.5 text-[12px] text-muted-foreground">
                {r.tipoLabel} · {PERIODO_RELATORIO_LABEL[r.periodo]} · gerado em {dataBR(r.geradoEm)} por{" "}
                {r.geradoPorNome}
              </div>
            </div>
            <button
              type="button"
              onClick={() => baixar(r.id, r.codigo)}
              disabled={baixandoId === r.id}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary/50 disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              {baixandoId === r.id ? "Gerando..." : "Baixar PDF"}
            </button>
          </Card>
        ))}
      </div>
    </main>
  );
}
