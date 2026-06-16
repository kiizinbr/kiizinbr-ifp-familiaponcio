"use client";

import { useEffect, useRef } from "react";

/**
 * Linha do "agora" na grade do dia (QW3). Overlay aditivo: posiciona-se em
 * `top` (px, calculado server-side com a MESMA formula minuto->px dos chips) e,
 * no PRIMEIRO mount, rola a tela ate a linha (scrollIntoView centralizado).
 *
 * - `pointer-events: none`: a linha NUNCA captura cliques — os chips de consulta
 *   (Links para o detalhe) continuam clicaveis por baixo dela.
 * - Cor da unidade via token `--unit` (medico = teal); nada inventado.
 * - Client porque scrollIntoView e API de browser (mesma justificativa do island
 *   AgendaDiaRefresh, que re-renderiza via router.refresh SEM remontar a arvore —
 *   logo o scroll mount-only NAO re-dispara a cada polling de 30s; o ref-guard
 *   reforca isso caso a arvore remonte).
 */
export function AgendaDiaNowMarker({ top, label }: { top: number; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const jaRolou = useRef(false);

  useEffect(() => {
    if (jaRolou.current) return;
    jaRolou.current = true;
    ref.current?.scrollIntoView({ block: "center", behavior: "auto" });
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute right-0 left-0"
      style={{ top, height: 0, borderTop: "2px solid var(--unit)", zIndex: 5 }}
    >
      <span
        className="mono absolute -translate-y-1/2 rounded-[4px] px-1 text-[10px] leading-none tabular-nums"
        style={{ left: 2, background: "var(--unit)", color: "var(--on-accent)" }}
      >
        {label}
      </span>
    </div>
  );
}
