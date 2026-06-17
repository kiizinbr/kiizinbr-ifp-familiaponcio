/**
 * Blocos visuais da direção CASA (cards, KPI, pill, list-row, pulso, cabeçalhos).
 * Tradução fiel das classes do Atlas para React+Tailwind, consumindo os tokens
 * (var(--unidade)/--ifp-*). Use junto dos componentes-assinatura.
 */
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { JubaRing } from "./JubaRing";

/** Card base CASA — papel branco, raio 18px, sombra quente. */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-[18px] border border-border bg-surface p-5 shadow-[var(--ifp-shadow-casa-sm)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Cabeçalho de página: título + descrição à esquerda, ações à direita. */
export function PageHeader({
  titulo,
  descricao,
  acoes,
}: {
  titulo: string;
  descricao?: ReactNode;
  acoes?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 className="text-[23px] font-semibold tracking-[0.01em] text-foreground">{titulo}</h2>
        {descricao ? <div className="mt-1 text-sm text-muted-foreground">{descricao}</div> : null}
      </div>
      {acoes ? <div className="flex flex-wrap items-center gap-3">{acoes}</div> : null}
    </div>
  );
}

/** Título de seção em caixa-alta, com ícone na cor da unidade. */
export function SecTitle({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <h3 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground">
      {icon ? <span className="text-primary [&>svg]:h-4 [&>svg]:w-4">{icon}</span> : null}
      {children}
    </h3>
  );
}

/** KPI — número grande, zero enfeite. */
export function Kpi({
  label,
  valor,
  delta,
  tendencia,
  alerta,
}: {
  label: string;
  valor: ReactNode;
  delta?: string;
  tendencia?: string;
  alerta?: boolean;
}) {
  return (
    <Card className={cn("relative overflow-hidden", alerta && "border-warning/60 bg-warning/10")}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {label}
        </span>
        {tendencia ? (
          <span className="rounded-full bg-[var(--unidade-suave)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--unidade-escuro)]">
            {tendencia}
          </span>
        ) : null}
      </div>
      <div className="text-[34px] font-semibold leading-none tabular-nums text-foreground">{valor}</div>
      {delta ? <div className="mt-2 text-[11.5px] font-semibold text-success">{delta}</div> : null}
    </Card>
  );
}

type PillTom = "neutro" | "ok" | "warn" | "unidade";
const PILL_TOM: Record<PillTom, string> = {
  neutro: "border-border text-foreground",
  ok: "border-success/30 bg-success/10 text-success",
  warn: "border-warning/30 bg-[var(--ifp-ambar-bg)] text-warning",
  unidade: "border-transparent bg-[var(--unidade-suave)] text-[var(--unidade-escuro)]",
};

export function Pill({ tom = "neutro", children }: { tom?: PillTom; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em]",
        PILL_TOM[tom],
      )}
    >
      {children}
    </span>
  );
}

/** Linha de lista (avatar + título/subtítulo + trailing). */
export function ListRow({
  avatar,
  titulo,
  subtitulo,
  trailing,
  className,
}: {
  avatar?: ReactNode;
  titulo: ReactNode;
  subtitulo?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-2.5 flex items-center gap-3.5 rounded-2xl border border-border bg-surface px-4 py-3.5 shadow-[var(--ifp-shadow-casa-sm)]",
        className,
      )}
    >
      {avatar ? (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--unidade-suave)] font-semibold text-[var(--unidade-escuro)]">
          {avatar}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-foreground">{titulo}</div>
        {subtitulo ? <div className="text-xs text-muted-foreground">{subtitulo}</div> : null}
      </div>
      {trailing}
    </div>
  );
}

/** Pulso de unidade — card com anel e status, recolorido pela cor da unidade. */
export function Pulso({
  nome,
  meta,
  pct,
  cor,
  status,
}: {
  nome: string;
  meta: string;
  pct: number;
  cor: string;
  status?: ReactNode;
}) {
  return (
    <div
      className="flex items-center gap-4 rounded-[18px] border border-border bg-surface p-5"
      style={{ borderLeft: `4px solid ${cor}` }}
    >
      <JubaRing pct={pct} size={54} color={cor} />
      <div className="flex-1">
        <div className="text-sm font-semibold uppercase tracking-[0.06em] text-foreground">{nome}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{meta}</div>
        {status ? <div className="mt-1.5">{status}</div> : null}
      </div>
    </div>
  );
}
