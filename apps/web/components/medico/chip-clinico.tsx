/**
 * Chips clínicos da prancha (direção CASA): alergia (vermelho), condição
 * crônica (âmbar) e neutro (info). Dados reais vêm da ficha do paciente.
 */
import { AlertTriangle, HeartPulse, Info } from "lucide-react";

import { cn } from "@/lib/cn";

type Tipo = "alergia" | "cronico" | "neutro";

const estilos: Record<Tipo, string> = {
  alergia: "border-danger/40 bg-danger/10 text-danger",
  cronico: "border-warning/40 bg-warning/10 text-warning",
  neutro: "border-border bg-muted text-muted-foreground",
};

const icones: Record<Tipo, React.ReactNode> = {
  alergia: <AlertTriangle className="h-3 w-3" />,
  cronico: <HeartPulse className="h-3 w-3" />,
  neutro: <Info className="h-3 w-3" />,
};

export function ChipClinico({
  tipo = "neutro",
  children,
  className,
}: {
  tipo?: Tipo;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        estilos[tipo],
        className,
      )}
    >
      {icones[tipo]}
      {children}
    </span>
  );
}
