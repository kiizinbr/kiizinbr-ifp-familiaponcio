import type { CSSProperties, HTMLAttributes } from "react";

type Variant = "default" | "success" | "warning" | "danger" | "info";

interface Props extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

const VARIANTS: Record<Variant, CSSProperties> = {
  default: {
    backgroundColor: "rgb(var(--ifp-surface-100))",
    color: "rgb(var(--ifp-muted))",
  },
  success: {
    backgroundColor: "rgb(var(--ifp-teal-500) / 0.15)",
    color: "rgb(var(--ifp-teal-700))",
  },
  warning: {
    backgroundColor: "rgb(var(--ifp-orange-500) / 0.15)",
    color: "rgb(var(--ifp-warning))",
  },
  danger: {
    backgroundColor: "rgb(var(--ifp-danger) / 0.12)",
    color: "rgb(var(--ifp-danger))",
  },
  info: {
    backgroundColor: "rgb(var(--ifp-orange-900) / 0.10)",
    color: "rgb(var(--ifp-orange-900))",
  },
};

/**
 * Badge universal canônico do DS v2.
 * Pill uppercase, 5 variants: default/success/warning/danger/info.
 */
export function Badge({ variant = "default", style, className = "", children, ...rest }: Props) {
  const composedStyle: CSSProperties = {
    ...VARIANTS[variant],
    padding: "2px 8px",
    borderRadius: "var(--ifp-radius-full)",
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    display: "inline-block",
    ...style,
  };

  return (
    <span style={composedStyle} className={className} {...rest}>
      {children}
    </span>
  );
}
