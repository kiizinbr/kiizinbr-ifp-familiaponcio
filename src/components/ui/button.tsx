import { forwardRef } from "react";
import type { ButtonHTMLAttributes, CSSProperties } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANT_STYLES: Record<Variant, CSSProperties> = {
  primary: {
    backgroundColor: "rgb(var(--ifp-orange-500))",
    color: "rgb(var(--ifp-canvas))",
  },
  secondary: {
    backgroundColor: "transparent",
    color: "rgb(var(--ifp-orange-900))",
    border: "1.5px solid rgb(var(--ifp-orange-900))",
  },
  ghost: {
    backgroundColor: "transparent",
    color: "rgb(var(--ifp-ink))",
  },
  danger: {
    backgroundColor: "rgb(var(--ifp-danger))",
    color: "rgb(var(--ifp-canvas))",
  },
};

const SIZE_STYLES: Record<Size, CSSProperties> = {
  sm: { padding: "6px 12px", fontSize: "13px" },
  md: { padding: "10px 16px", fontSize: "14px" },
  lg: { padding: "12px 20px", fontSize: "16px" },
};

/**
 * Botão universal canônico do DS v2.
 * Variants: primary (laranja CTA), secondary (outline marrom), ghost (texto), danger (vermelho).
 */
export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", size = "md", style, className = "", children, ...rest },
  ref,
) {
  const composedStyle: CSSProperties = {
    ...VARIANT_STYLES[variant],
    ...SIZE_STYLES[size],
    fontWeight: 700,
    borderRadius: "var(--ifp-radius-md)",
    transition: "opacity var(--ifp-transition-fast)",
    cursor: rest.disabled ? "not-allowed" : "pointer",
    opacity: rest.disabled ? 0.5 : 1,
    ...style,
  };

  return (
    <button ref={ref} style={composedStyle} className={`font-bold ${className}`} {...rest}>
      {children}
    </button>
  );
});
