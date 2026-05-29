import Image from "next/image";
import type { ReactNode } from "react";

interface Props {
  titulo: string;
  descricao: string;
  cta?: ReactNode;
}

/**
 * EmptyState universal canônico do DS v2.
 * Mascote do leão (96x96, opacidade 30%) + título + descrição + CTA opcional.
 * Usar em listas vazias, "ainda não cadastrado", "sem triagens pendentes".
 */
export function EmptyState({ titulo, descricao, cta }: Props) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{ padding: "var(--ifp-space-12) var(--ifp-space-4)" }}
    >
      <Image src="/logo/ifp-symbol.png" alt="IFP" width={96} height={96} style={{ opacity: 0.3 }} />
      <h3 className="mt-6 text-lg font-bold" style={{ color: "rgb(var(--ifp-ink))" }}>
        {titulo}
      </h3>
      <p className="mt-2 max-w-xs text-sm" style={{ color: "rgb(var(--ifp-muted))" }}>
        {descricao}
      </p>
      {cta && <div style={{ marginTop: "var(--ifp-space-6)" }}>{cta}</div>}
    </div>
  );
}
