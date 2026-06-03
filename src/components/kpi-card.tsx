import type { UnitScope } from "@/lib/rbac-types";

interface KpiCardProps {
  label: string;
  value: string | number;
  delta?: string;
  /** Mantido por compat de API; a cor agora segue o acento da unidade (kit). */
  accent?: UnitScope | "laranja" | "cinza";
  hint?: string;
  /** Direção do delta (cor verde/vermelho). Default "up". */
  deltaDir?: "up" | "down";
}

/** KPI card — kit (`.kpi`). Número em IBM Plex Mono, acento via `--accent`. */
export function KpiCard({ label, value, delta, hint, deltaDir = "up" }: KpiCardProps) {
  return (
    <div className="kpi">
      <div className="kpi-top">
        <span className="micro">{label}</span>
        {delta ? <span className={`kpi-delta ${deltaDir}`}>{delta}</span> : null}
      </div>
      <div className="kpi-val">{value}</div>
      {hint ? <p className="t-small">{hint}</p> : null}
    </div>
  );
}
