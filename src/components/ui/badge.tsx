import type { HTMLAttributes } from "react";

type Variant = "default" | "success" | "warning" | "danger" | "info";

interface Props extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

const VARIANT_CLASS: Record<Variant, string> = {
  default: "badge-default",
  success: "badge-success",
  warning: "badge-warning",
  danger: "badge-danger",
  info: "badge-info",
};

/**
 * Badge universal — Design Kit. Pill com borda, 5 variants.
 * `info` segue o acento (teal de sistema / cor da unidade), não mais laranja.
 */
export function Badge({ variant = "default", className = "", children, ...rest }: Props) {
  return (
    <span className={`badge ${VARIANT_CLASS[variant]} ${className}`.trim()} {...rest}>
      {children}
    </span>
  );
}
