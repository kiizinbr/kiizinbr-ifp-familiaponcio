import type { ReactNode } from "react";
import styles from "../capacitacao.module.css";

/** Variantes do Badge canônico (espelha BadgeVariant de lib/capacitacao/ui.ts). */
export type KitVariant = "default" | "info" | "success" | "warning" | "danger";

const BADGE_CLASS: Record<KitVariant, string | undefined> = {
  default: styles.badgeDefault,
  info: styles.badgeInfo,
  success: styles.badgeSuccess,
  warning: styles.badgeWarning,
  danger: styles.badgeDanger,
};

export function KitBadge({ variant, children }: { variant: KitVariant; children: ReactNode }) {
  return <span className={`${styles.badge} ${BADGE_CLASS[variant]}`}>{children}</span>;
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
    <div className={styles.head}>
      <div>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 className={styles.title}>{title}</h1>
        {desc ? <p className={styles.desc}>{desc}</p> : null}
      </div>
      {action ? <div className={styles.btnRow}>{action}</div> : null}
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
          className={`${styles.meterFill} ${lotada ? styles.meterFull : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className={styles.meterText}>
        <b>{ocupadas}</b> / {capacidade} vagas{lotada ? " · lotada" : ""}
      </p>
    </div>
  );
}
