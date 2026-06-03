import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Mostra spinner e bloqueia interação (classe .is-loading do kit). */
  loading?: boolean;
}

const VARIANT_CLASS: Record<Variant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  danger: "btn-danger",
};
const SIZE_CLASS: Record<Size, string> = { sm: "btn-sm", md: "", lg: "btn-lg" };

/**
 * Botão universal — Design Kit "Ferramenta Clínica Premium".
 * `primary` = gradiente do acento (teal de sistema, ou cor da unidade sob
 * [data-unit-accent]). Variants: primary | secondary | ghost | danger.
 */
export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", size = "md", loading = false, className = "", children, ...rest },
  ref,
) {
  const cls = [
    "btn",
    VARIANT_CLASS[variant],
    SIZE_CLASS[size],
    loading ? "is-loading" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button ref={ref} className={cls} aria-disabled={loading || undefined} {...rest}>
      {children}
    </button>
  );
});
