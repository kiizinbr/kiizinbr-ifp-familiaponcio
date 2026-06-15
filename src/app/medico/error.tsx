"use client";

import { useEffect } from "react";
import Link from "next/link";
import type { Route } from "next";
import Image from "next/image";

/**
 * Error boundary de toda a subárvore `/medico`. Intercepta o `throw` de qualquer
 * Server Component/action da área médica (ex.: `throw new Error("Sem permissão")`)
 * e troca o overlay técnico do Next por uma tela acolhedora em pt-BR.
 *
 * É um Client Component (contrato do Next App Router) — não chama `auth()`/`db`
 * nem reusa o `MedicoShell` (que é server). Só mostra a UI do kit (`.empty`) e
 * oferece `reset()` (re-render do segmento) + volta ao balcão. A action em si
 * fica intocada; este boundary só captura o erro que ela lança.
 */
export default function MedicoError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Loga server-side via console (não engole o erro).
    console.error(error);
  }, [error]);

  return (
    <div
      className="ifp-kit"
      data-unit="medico"
      data-unit-accent
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "var(--bg)",
      }}
    >
      <div className="empty" role="alert">
        <Image src="/logo/ifp-symbol.png" alt="" width={96} height={96} />
        <div className="e-title">Não foi possível concluir</div>
        <p className="e-msg">Tente de novo ou chame o suporte.</p>
        <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "center" }}>
          <button type="button" className="btn btn-primary" onClick={() => reset()}>
            Tentar de novo
          </button>
          <Link href={"/medico" as Route} className="btn btn-secondary">
            Voltar ao balcão
          </Link>
        </div>
      </div>
    </div>
  );
}
