import { cn } from "@/lib/utils";

/** Variantes visuais do botão — Design Kit "Ferramenta Clínica Premium". */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  danger: "btn-danger",
};

const SIZE_CLASS: Record<ButtonSize, string> = { sm: "btn-sm", md: "", lg: "btn-lg" };

/**
 * Compõe a className de um botão do kit a partir de variante/tamanho/estado.
 * Centralizado aqui (e testado) para que `Button`/`SubmitButton` fiquem como
 * cascas finas e a classe condicional saia de `cn(...)` — nunca de template
 * literal (o prettier-plugin-tailwindcss mangla template literal condicional).
 */
export function buttonClassName(opts: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  className?: string;
}): string {
  const { variant = "primary", size = "md", loading = false, className } = opts;
  return cn("btn", VARIANT_CLASS[variant], SIZE_CLASS[size], loading && "is-loading", className);
}
