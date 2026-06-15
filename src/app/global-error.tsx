"use client";

import { useEffect } from "react";
import Link from "next/link";
import type { Route } from "next";
import Image from "next/image";
// global-error substitui o root layout inteiro, então o globals.css (tokens +
// componentes do kit) NÃO está garantido aqui — importamos explicitamente para
// que `.ifp-kit`, `.empty`, `.btn` e os tokens (--bg/--text) resolvam.
import "./globals.css";

/**
 * Error boundary global (catch-all). Captura o `throw` de qualquer Server
 * Component/action FORA de `/medico` (que tem o seu próprio `error.tsx` mais
 * específico) — capacitacao, app, social, poncio, inicio, admin, conta — e
 * troca o overlay técnico do Next por uma tela acolhedora em pt-BR.
 *
 * Diferença crítica do contrato Next vs. um `error.tsx` comum: `global-error`
 * SUBSTITUI o root layout, então PRECISA renderizar `<html>`/`<body>` próprios.
 * Espelhamos o root layout (lang="pt-BR", data-theme="light") e reusamos o
 * cartão `.empty` do `medico/error.tsx`, com CTA genérico (`/app`) no lugar do
 * "Voltar ao balcão". É um Client Component (contrato do App Router).
 */
export default function GlobalError({
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
    <html lang="pt-BR" data-theme="light">
      <body className="antialiased">
        <main
          className="ifp-kit"
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
              <Link href={"/app" as Route} className="btn btn-secondary">
                Voltar ao início
              </Link>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
