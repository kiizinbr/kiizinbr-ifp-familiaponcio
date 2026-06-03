import Image from "next/image";
import type { ReactNode } from "react";

interface Props {
  titulo: string;
  descricao: string;
  cta?: ReactNode;
}

/**
 * EmptyState universal — Design Kit (`.empty`). Mascote do leão a ~30% +
 * título + mensagem + CTA opcional. Listas vazias, "nada pendente", etc.
 */
export function EmptyState({ titulo, descricao, cta }: Props) {
  return (
    <div className="empty">
      <Image src="/logo/ifp-symbol.png" alt="IFP" width={96} height={96} />
      <div className="e-title">{titulo}</div>
      <p className="e-msg">{descricao}</p>
      {cta ? <div style={{ marginTop: 12 }}>{cta}</div> : null}
    </div>
  );
}
