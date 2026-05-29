import type { CSSProperties, HTMLAttributes } from "react";
import type { UnidadeSlug } from "@/lib/unidades";

interface Props extends HTMLAttributes<HTMLDivElement> {
  /** Adiciona border-top 4px com a cor de filtro da unidade indicada. */
  accent?: UnidadeSlug;
  /** Se true, eleva no hover. */
  hoverable?: boolean;
}

/**
 * Card universal canônico do DS v2.
 * Surface branca, borda fina, sombra suave, padding 24px, radius 16px.
 * accent="medico" adiciona uma faixa colorida no topo com a cor temática.
 */
export function Card({ accent, hoverable, style, className = "", children, ...rest }: Props) {
  const baseStyle: CSSProperties = {
    backgroundColor: "rgb(var(--ifp-canvas))",
    border: "1px solid rgb(var(--ifp-surface-200))",
    borderRadius: "var(--ifp-radius-lg)",
    boxShadow: "var(--ifp-shadow-sm)",
    padding: "var(--ifp-space-6)",
    transition: "box-shadow var(--ifp-transition-base), transform var(--ifp-transition-base)",
    ...(accent ? { borderTop: `4px solid rgb(var(--ifp-filter-${accent}))` } : {}),
    ...style,
  };

  const hoverClass = hoverable ? "hover:-translate-y-0.5 hover:shadow-md" : "";

  return (
    <div style={baseStyle} className={`${hoverClass} ${className}`} {...rest}>
      {children}
    </div>
  );
}
