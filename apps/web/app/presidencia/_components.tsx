"use client";

/** Blocos de gráfico reaproveitados pelas telas da Presidência (barras horizontais
 * e série mensal). Mantêm o estilo CASA (barra arredondada, números tabulares). */

export interface BarraItem {
  label: string;
  valor: number;
  cor?: string;
  sufixo?: string;
}

/** Barras horizontais simples; a maior define a escala. */
export function Barras({ itens }: { itens: BarraItem[] }) {
  const visiveis = itens.filter((i) => i.valor > 0);
  if (visiveis.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem dados ainda.</p>;
  }
  const max = Math.max(1, ...visiveis.map((i) => i.valor));
  return (
    <div className="space-y-2.5">
      {visiveis.map((i) => (
        <div key={i.label} className="flex items-center gap-3 text-sm">
          <span className="w-36 shrink-0 truncate text-muted-foreground" title={i.label}>
            {i.label}
          </span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{ width: `${(i.valor / max) * 100}%`, background: i.cor ?? "var(--unidade)" }}
            />
          </div>
          <span className="w-14 shrink-0 text-right font-semibold tabular-nums text-foreground">
            {i.valor.toLocaleString("pt-BR")}
            {i.sufixo ?? ""}
          </span>
        </div>
      ))}
    </div>
  );
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function mesLabel(ym: string) {
  const [ano = "", mes = ""] = ym.split("-");
  return `${MESES[Number(mes) - 1] ?? mes}/${ano.slice(2)}`;
}

/** Série temporal (12 meses) em barras verticais finas. */
export function SerieMensal({ dados }: { dados: { mes: string; total: number }[] }) {
  if (dados.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem dados no período.</p>;
  }
  const max = Math.max(1, ...dados.map((d) => d.total));
  return (
    <div className="flex items-end gap-2 overflow-x-auto pb-1">
      {dados.map((d) => (
        <div key={d.mes} className="flex min-w-[34px] flex-1 flex-col items-center gap-1.5">
          <span className="text-[11px] font-semibold tabular-nums text-foreground">{d.total}</span>
          <div className="flex h-28 w-full items-end">
            <div
              className="w-full rounded-t-md bg-[var(--unidade)]"
              style={{ height: `${Math.max(4, (d.total / max) * 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground">{mesLabel(d.mes)}</span>
        </div>
      ))}
    </div>
  );
}
