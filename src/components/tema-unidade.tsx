import type { TemaCasa } from "@/lib/tema-casa";

interface TemaUnidadeProps {
  /** Tema CASA (slug canônico da unidade). null/undefined → trio default "Corte". */
  tema: TemaCasa | null | undefined;
  className?: string;
  children: React.ReactNode;
}

/**
 * Provider mínimo do tema CASA — aplica `data-theme="<unidade>"` num subtree.
 * 100% CSS, sem JS de tema (Server Component): o bloco combinado de
 * src/styles/casa-tokens.css re-resolve o trio --unidade e os aliases
 * --casa-* e --accent dentro deste container. Componentes do kit e classes da
 * ponte Tailwind (bg-primary, text-foreground, shadow-casa…) seguem a
 * unidade automaticamente.
 *
 * Uso típico (card temático na vitrine ou layout de unidade):
 *   <TemaUnidade tema="medico" className="min-h-screen">…</TemaUnidade>
 */
export function TemaUnidade({ tema, className, children }: TemaUnidadeProps) {
  return (
    <div data-theme={tema ?? undefined} className={className}>
      {children}
    </div>
  );
}
