/**
 * JubaRing — anel de progresso "juba do leão" da direção CASA.
 * Trilha em --ifp-linha; arco na cor da unidade (ou cor passada). Começa no topo.
 */
import type { ReactNode } from "react";

type JubaRingProps = {
  /** 0–100 */
  pct: number;
  size?: number;
  /** cor do arco; default = unidade ativa */
  color?: string;
  /** conteúdo central; default = "{pct}%" */
  label?: ReactNode;
  className?: string;
};

export function JubaRing({ pct, size = 64, color = "var(--unidade)", label, className }: JubaRingProps) {
  const valor = Math.max(0, Math.min(100, pct));
  const r = size / 2 - 5;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - valor / 100);
  const cx = size / 2;
  return (
    <span
      className={className}
      style={{ position: "relative", flex: "0 0 auto", display: "inline-block", width: size, height: size }}
    >
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }} aria-hidden>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--ifp-linha)" strokeWidth={5} />
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <span
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 600,
          color: "var(--ifp-tinta)",
          fontSize: size * 0.2,
        }}
      >
        {label ?? `${valor}%`}
      </span>
    </span>
  );
}
