import type { UnitScope } from "@/lib/rbac-types";

interface KpiCardProps {
  label: string;
  value: string | number;
  delta?: string;
  /** Color accent — usa token IFP do brandbook */
  accent?: UnitScope | "laranja" | "cinza";
  hint?: string;
}

const ACCENT_VAR: Record<NonNullable<KpiCardProps["accent"]>, string> = {
  medico: "var(--ifp-filter-medico)",
  capacitacao: "var(--ifp-filter-capacitacao)",
  esportivo: "var(--ifp-filter-esportivo)",
  recreativo: "var(--ifp-filter-recreativo)",
  laranja: "var(--ifp-orange-500)",
  cinza: "var(--ifp-ink)",
};

export function KpiCard({ label, value, delta, accent = "cinza", hint }: KpiCardProps) {
  const color = ACCENT_VAR[accent];
  return (
    <div className="ifp-card ifp-card-hover p-6">
      <p className="text-sm font-medium text-[rgb(var(--ifp-muted))]">{label}</p>
      <div className="mt-3 flex items-baseline gap-2.5">
        <span className="text-[2.6rem] leading-none font-bold tracking-tight text-[rgb(var(--ifp-ink))]">
          {value}
        </span>
        {delta && (
          <span className="text-sm font-semibold" style={{ color: `rgb(${color})` }}>
            {delta}
          </span>
        )}
      </div>
      {hint && <p className="mt-2 text-[13px] text-[rgb(var(--ifp-muted))]">{hint}</p>}
    </div>
  );
}
