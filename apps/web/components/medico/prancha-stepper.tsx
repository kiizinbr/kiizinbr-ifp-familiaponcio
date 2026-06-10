/**
 * Stepper da prancha de atendimento (5 passos, navegação livre).
 * Port do PranchaFlow do protótipo Connect: done/current/todo via estado React.
 */
import { Check } from "lucide-react";

import { cn } from "@/lib/cn";

export const PASSOS_PRANCHA = ["Resumo", "Queixa", "Exame", "Conduta", "Selo"] as const;

export function PranchaStepper({
  atual,
  onIrPara,
}: {
  atual: number;
  onIrPara: (passo: number) => void;
}) {
  return (
    <nav aria-label="Passos do atendimento" className="flex items-center gap-1 sm:gap-2">
      {PASSOS_PRANCHA.map((nome, i) => {
        const estado = i < atual ? "done" : i === atual ? "current" : "todo";
        return (
          <button
            key={nome}
            type="button"
            onClick={() => onIrPara(i)}
            aria-current={estado === "current" ? "step" : undefined}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
              estado === "current" && "border-primary bg-primary text-primary-foreground",
              estado === "done" && "border-primary/40 bg-primary/10 text-primary",
              estado === "todo" && "border-border bg-surface text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold",
                estado === "current" && "bg-primary-foreground/20",
                estado === "done" && "bg-primary/20",
                estado === "todo" && "bg-muted",
              )}
            >
              {estado === "done" ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <span className="hidden sm:inline">{nome}</span>
          </button>
        );
      })}
    </nav>
  );
}
