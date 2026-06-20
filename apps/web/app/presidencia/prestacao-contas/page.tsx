"use client";

/**
 * Prestação de Contas — escolhe um período, vê os NÚMEROS REAIS e baixa o PDF
 * com selo CASA. Sem IA: o resumo é gerado dos próprios números (determinístico).
 */
import { useState } from "react";
import { useSession } from "next-auth/react";
import { Download, FileText } from "lucide-react";

import { Card, Kpi, PageHeader, SecTitle } from "@/components/casa";
import { Alerta, Spinner } from "@/components/ui";
import { API_BASE_URL } from "@/lib/api";
import { usePrestacaoContas, type PeriodoChave, type PrestacaoContas } from "@/lib/use-presidencia";

const PERIODOS: { chave: PeriodoChave; label: string }[] = [
  { chave: "mes", label: "Este mês" },
  { chave: "ano", label: "Este ano" },
  { chave: "12m", label: "Últimos 12 meses" },
];

function resumoTexto(d: PrestacaoContas) {
  const fam = d.novas.familias === 1 ? "nova família" : "novas famílias";
  const at = d.realizados.atendimentos === 1 ? "atendimento" : "atendimentos";
  return (
    `No período (${d.periodo.label.toLowerCase()}), o Instituto acolheu ${d.novas.familias} ${fam} ` +
    `e realizou ${d.realizados.atendimentos} ${at}. A base atual soma ${d.base.familiasAtendidas} ` +
    `famílias atendidas (${d.base.pessoasImpactadas} pessoas), das quais ${d.base.cross2maisPct}% ` +
    `são acompanhadas por duas ou mais unidades.`
  );
}

export default function PrestacaoContasPage() {
  const [periodo, setPeriodo] = useState<PeriodoChave>("12m");
  const { data, isLoading, error } = usePrestacaoContas(periodo);
  const { data: session } = useSession();

  const [baixando, setBaixando] = useState(false);
  const [erroPdf, setErroPdf] = useState<string | null>(null);

  async function baixarPdf() {
    setErroPdf(null);
    setBaixando(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/presidencia/prestacao-contas/pdf?periodo=${periodo}`,
        { headers: { Authorization: `Bearer ${session?.accessToken ?? ""}` } },
      );
      if (!res.ok) throw new Error(`Falha ao gerar o PDF (${res.status}).`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `prestacao-contas-${periodo}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErroPdf((e as Error).message);
    } finally {
      setBaixando(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <PageHeader
        titulo="Prestação de Contas"
        descricao="Números reais do período, prontos para doadores e editais."
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {PERIODOS.map((p) => (
          <button
            key={p.chave}
            type="button"
            onClick={() => setPeriodo(p.chave)}
            className={
              periodo === p.chave
                ? "rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                : "rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:border-primary/50"
            }
          >
            {p.label}
          </button>
        ))}
      </div>

      {isLoading ? <Spinner label="Carregando números..." /> : null}
      {error ? <Alerta>{(error as Error).message}</Alerta> : null}

      {data ? (
        <>
          <Card className="mb-4">
            <SecTitle icon={<FileText />}>Resumo do período</SecTitle>
            <p className="text-sm leading-relaxed text-foreground">{resumoTexto(data)}</p>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Kpi label="Famílias acolhidas" valor={data.novas.familias.toLocaleString("pt-BR")} />
            <Kpi label="Atendimentos realizados" valor={data.realizados.atendimentos.toLocaleString("pt-BR")} />
            <Kpi label="Novas matrículas" valor={data.novas.matriculas.toLocaleString("pt-BR")} />
            <Kpi label="Certificados emitidos" valor={data.realizados.certificados.toLocaleString("pt-BR")} />
            <Kpi label="Graduações concedidas" valor={data.realizados.graduacoes.toLocaleString("pt-BR")} />
          </div>

          <Card className="mt-6">
            <SecTitle>Base atual (acumulado)</SecTitle>
            <div className="grid gap-4 sm:grid-cols-3">
              <Linha rotulo="Famílias atendidas" valor={data.base.familiasAtendidas} />
              <Linha rotulo="Pessoas impactadas" valor={data.base.pessoasImpactadas} />
              <Linha
                rotulo="Em 2+ unidades"
                valor={data.base.cross2mais}
                sufixo={` (${data.base.cross2maisPct}%)`}
              />
            </div>
          </Card>

          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={baixarPdf}
              disabled={baixando}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-ifp-sm transition hover:bg-primary-hover disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              {baixando ? "Gerando PDF..." : "Baixar PDF"}
            </button>
            {erroPdf ? <span className="text-sm text-danger">{erroPdf}</span> : null}
          </div>
        </>
      ) : null}
    </main>
  );
}

function Linha({
  rotulo,
  valor,
  sufixo,
}: {
  rotulo: string;
  valor: number;
  sufixo?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface px-4 py-4">
      <div className="text-2xl font-semibold tabular-nums text-foreground">
        {valor.toLocaleString("pt-BR")}
        {sufixo ? <span className="text-base font-medium text-muted-foreground">{sufixo}</span> : null}
      </div>
      <div className="mt-0.5 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
        {rotulo}
      </div>
    </div>
  );
}
