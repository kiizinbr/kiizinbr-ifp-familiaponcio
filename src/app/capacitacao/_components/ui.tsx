import type { ReactNode } from "react";
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

export function PageHead({
  eyebrow,
  title,
  desc,
  action,
}: {
  eyebrow: string;
  title: string;
  desc?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <p className="micro text-accent">{eyebrow}</p>
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
