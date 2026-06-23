/**
 * Selo da classificação de risco da triagem de enfermagem (protocolo de
 * acolhimento). Cores mapeadas nos tokens semânticos do CASA — sem inventar
 * paleta nova. VERMELHO (emergência) é o tom mais forte (danger).
 */
import { cn } from "@/lib/cn";
import { CLASSIFICACAO_RISCO_LABEL, type ClassificacaoRisco } from "@/lib/api";

const estilos: Record<ClassificacaoRisco, string> = {
  AZUL: "border-info/40 bg-info/10 text-info",
  VERDE: "border-success/40 bg-success/10 text-success",
  AMARELO: "border-warning/40 bg-warning/10 text-warning",
  LARANJA: "border-warning/60 bg-warning/20 text-warning",
  VERMELHO: "border-danger/40 bg-danger/10 text-danger",
};

export function BadgeRisco({
  risco,
  className,
}: {
  risco: ClassificacaoRisco;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        estilos[risco],
        className,
      )}
    >
      <span className="h-2 w-2 shrink-0 rounded-full bg-current" aria-hidden />
      {CLASSIFICACAO_RISCO_LABEL[risco]}
    </span>
  );
}
