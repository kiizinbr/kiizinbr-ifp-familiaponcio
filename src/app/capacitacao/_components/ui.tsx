import type { ReactNode } from "react";
import Link from "next/link";
import type { Route } from "next";
import clsx from "clsx";
import { Badge } from "@/components/ui/badge";
import styles from "../capacitacao.module.css";

/** Variantes do Badge canônico (espelha BadgeVariant de lib/capacitacao/ui.ts). */
export type KitVariant = "default" | "info" | "success" | "warning" | "danger";

/**
 * Pílula da Capacitação — agora um wrapper fino sobre o <Badge> do kit
 * (src/components/ui/badge.tsx). Assinatura (variant/children) inalterada,
 * então as ~9 telas que importam KitBadge migram sem tocar nos call-sites.
 */
export function KitBadge({ variant, children }: { variant: KitVariant; children: ReactNode }) {
  return <Badge variant={variant}>{children}</Badge>;
}

/**
 * Cabeçalho de página da Capacitação. O `eyebrow` é uma trilha "Seção · Contexto".
 *
 * C10 (mini-breadcrumb): passando `eyebrowHref`, o PRIMEIRO segmento (antes do
 * primeiro "·") vira um Link de volta (ex "Capacitação" → /capacitacao) e o resto
 * fica como contexto não-clicável. ADITIVO: sem `eyebrowHref` o eyebrow continua
 * sendo texto plano, então os call-sites antigos que passam só `eyebrow` não mudam.
 */
export function PageHead({
  eyebrow,
  eyebrowHref,
  title,
  desc,
  action,
}: {
  eyebrow: string;
  eyebrowHref?: Route | string;
  title: string;
  desc?: string;
  action?: ReactNode;
}) {
  const [primeiro, ...resto] = eyebrow.split("·").map((s) => s.trim());
  const contexto = resto.join(" · ");
  return (
    <div className="page-head">
      <div>
        {eyebrowHref ? (
          <p className="micro text-accent">
            <Link href={eyebrowHref as Route} className={styles.crumbLink}>
              {primeiro}
            </Link>
            {contexto ? <span className={styles.crumbSep}> · {contexto}</span> : null}
          </p>
        ) : (
          <p className="micro text-accent">{eyebrow}</p>
        )}
        <h1 className="t-h1">{title}</h1>
        {desc ? <p className="ph-sub">{desc}</p> : null}
      </div>
      {action ? <div className="actions">{action}</div> : null}
    </div>
  );
}

/** Medidor de ocupação de vagas (capacidade vs. matrículas ativas). */
export function VagasMeter({ ocupadas, capacidade }: { ocupadas: number; capacidade: number }) {
  const pct = capacidade > 0 ? Math.min(100, Math.round((ocupadas / capacidade) * 100)) : 0;
  const lotada = ocupadas >= capacidade && capacidade > 0;
  return (
    <div>
      <div className={styles.meter}>
        <div
          className={clsx(styles.meterFill, lotada && styles.meterFull)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className={styles.meterText}>
        <b>{ocupadas}</b> / {capacidade} vagas{lotada ? " · lotada" : ""}
      </p>
    </div>
  );
}
