/**
 * CoroaSeal — selo de status com coroa (a coroa = elegibilidade/estado).
 * Sempre com rótulo. Variantes: aprovado (dourado), analise (neutro), bloqueado (erro).
 */
import type { ReactNode } from "react";

type CoroaStatus = "aprovado" | "analise" | "bloqueado";

const VARIANTES: Record<CoroaStatus, { bg: string; color: string; border: string; icon: string }> = {
  aprovado: { bg: "rgba(201,150,47,.14)", color: "#8a6516", border: "rgba(201,150,47,.55)", icon: "var(--ifp-dourado)" },
  analise: { bg: "var(--ifp-white)", color: "#9a8f84", border: "var(--ifp-linha)", icon: "#bcae9f" },
  bloqueado: { bg: "var(--ifp-erro-bg)", color: "var(--color-danger)", border: "rgba(179,38,30,.3)", icon: "var(--color-danger)" },
};

type CoroaSealProps = {
  status?: CoroaStatus;
  children: ReactNode;
  className?: string;
};

export function CoroaSeal({ status = "aprovado", children, className }: CoroaSealProps) {
  const v = VARIANTES[status];
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "4px 11px 4px 8px",
        borderRadius: 999,
        fontSize: 10.5,
        fontWeight: 600,
        letterSpacing: "0.07em",
        textTransform: "uppercase",
        border: "1px solid",
        background: v.bg,
        color: v.color,
        borderColor: v.border,
      }}
    >
      <svg viewBox="0 0 24 18" fill="currentColor" aria-hidden style={{ width: 16, height: 13, color: v.icon }}>
        <path d="M3 5l4 4 5-6 5 6 4-4v10H3z" />
      </svg>
      {children}
    </span>
  );
}
