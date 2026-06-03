import type { HTMLAttributes } from "react";
import type { UnidadeSlug } from "@/lib/unidades";

interface Props extends HTMLAttributes<HTMLDivElement> {
  /** Faixa de identidade da unidade no topo (gradiente --unit). */
  accent?: UnidadeSlug;
  /** Eleva no hover. */
  hoverable?: boolean;
}

/**
 * Card universal — Design Kit. Surface + borda + sombra do kit.
 * Padding padrão `p-6` (24px) embutido e SOBRESCREVÍVEL via className `!p-0`
 * (usado por tabelas/listas densas). `accent` adiciona a faixa de unidade.
 */
export function Card({ accent, hoverable, className = "", children, ...rest }: Props) {
  const cls = ["card", "p-6", accent ? "unit-strip" : "", hoverable ? "card-hover" : "", className]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  );
}
