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
  medico: "var(--ifp-medico)",
  capacitacao: "var(--ifp-capacitacao)",
  esportivo: "var(--ifp-esportivo)",
  recreativo: "var(--ifp-recreativo)",
  laranja: "var(--ifp-laranja)",
  cinza: "var(--ifp-cinza)",
};

export function KpiCard({ label, value, delta, accent = "cinza", hint }: KpiCardProps) {
  const color = ACCENT_VAR[accent];
  return (
    <div className="rounded-lg border bg-white p-5 shadow-sm">
      <div className="h-1 w-10 rounded" style={{ background: `rgb(${color})` }} />
      <p className="mt-3 text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-semibold text-slate-900">{value}</span>
        {delta && (
          <span className="text-xs font-medium" style={{ color: `rgb(${color})` }}>
            {delta}
          </span>
        )}
      </div>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
