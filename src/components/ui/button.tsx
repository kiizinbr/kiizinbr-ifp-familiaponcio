import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { buttonClassName, type ButtonVariant, type ButtonSize } from "@/lib/ui/button";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Mostra spinner e sinaliza estado ocupado (classe .is-loading do kit). */
  loading?: boolean;
}

/**
 * Botão universal — Design Kit "Ferramenta Clínica Premium".
 * `primary` = gradiente do acento (teal de sistema, ou cor da unidade sob
 * [data-unit-accent]). Variants: primary | secondary | ghost | danger.
 *
 * Quando `loading`, anuncia `aria-busy` para tecnologia assistiva — o spinner
 * sozinho não comunica estado (o texto vira `color: transparent` no kit).
 */
export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", size = "md", loading = false, className = "", children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={buttonClassName({ variant, size, loading, className })}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      {...rest}
    >
      {children}
    </button>
  );
});
