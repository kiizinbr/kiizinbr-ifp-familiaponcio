/**
 * Controles de UI reutilizáveis do IFP Connect.
 *
 * Pequenos blocos estilizados com os tokens do design system (cores semânticas
 * que mudam por unidade via data-theme). Usam forwardRef para casar com o
 * register() do React Hook Form, que precisa do ref do elemento nativo.
 */
import { forwardRef } from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/cn";
import { STATUS_LABEL, type StatusElegibilidade } from "@/lib/api";

const controleBase =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground " +
  "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

// ------------------------------------------------------------
// Campo: label + dica opcional + mensagem de erro
// ------------------------------------------------------------
export function Campo({
  label,
  htmlFor,
  erro,
  obrigatorio,
  dica,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  erro?: string;
  obrigatorio?: boolean;
  dica?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground">
        {label}
        {obrigatorio ? <span className="ml-0.5 text-danger">*</span> : null}
      </label>
      {children}
      {dica && !erro ? <p className="text-xs text-muted-foreground">{dica}</p> : null}
      {erro ? (
        <p role="alert" className="text-xs text-danger">
          {erro}
        </p>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------
// Input / Select / Textarea / Checkbox
// ------------------------------------------------------------
export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(controleBase, className)} {...props} />;
  },
);

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(controleBase, "appearance-none", className)} {...props}>
      {children}
    </select>
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(controleBase, "min-h-[80px]", className)} {...props} />;
});

export const Checkbox = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { label: string }
>(function Checkbox({ className, label, id, ...props }, ref) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
      <input
        ref={ref}
        id={id}
        type="checkbox"
        className={cn(
          "h-4 w-4 rounded border-border text-ifp-orange focus:ring-ifp-orange/30",
          className,
        )}
        {...props}
      />
      {label}
    </label>
  );
});

// ------------------------------------------------------------
// Botão (variantes)
// ------------------------------------------------------------
type Variante = "primary" | "outline" | "ghost" | "danger";

const variantes: Record<Variante, string> = {
  primary: "bg-primary text-primary-foreground shadow-ifp-sm hover:bg-primary-hover",
  outline: "border border-border bg-surface text-foreground hover:bg-muted",
  ghost: "text-foreground hover:bg-muted",
  danger: "bg-danger text-ifp-white hover:opacity-90",
};

export function Botao({
  variante = "primary",
  carregando,
  className,
  children,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante;
  carregando?: boolean;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition disabled:opacity-60",
        variantes[variante],
        className,
      )}
      disabled={disabled || carregando}
      {...props}
    >
      {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

// ------------------------------------------------------------
// BadgeStatus: pílula colorida por status de elegibilidade
// ------------------------------------------------------------
const statusEstilo: Record<StatusElegibilidade, string> = {
  APROVADO: "border-success text-success",
  PENDENTE: "border-warning text-warning",
  REPROVADO: "border-danger text-danger",
  SUSPENSO: "border-warning text-warning",
  DESLIGADO: "border-border text-muted-foreground",
};

export function BadgeStatus({ status }: { status: StatusElegibilidade }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        statusEstilo[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

// ------------------------------------------------------------
// Alerta: caixa de mensagem (erro/info)
// ------------------------------------------------------------
export function Alerta({
  tipo = "erro",
  children,
}: {
  tipo?: "erro" | "info";
  children: React.ReactNode;
}) {
  return (
    <div
      role={tipo === "erro" ? "alert" : "status"}
      className={cn(
        "rounded-md border px-4 py-3 text-sm",
        tipo === "erro"
          ? "border-danger/40 text-danger"
          : "border-border bg-muted text-muted-foreground",
      )}
    >
      {children}
    </div>
  );
}

// ------------------------------------------------------------
// Spinner centralizado (estados de carregamento de página)
// ------------------------------------------------------------
export function Spinner({ label = "Carregando..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
      {label}
    </div>
  );
}
