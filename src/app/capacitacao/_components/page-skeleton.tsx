import styles from "../capacitacao.module.css";

/**
 * Esqueleto de carregamento das telas da Capacitação (C10). Fallback de Suspense
 * dos `loading.tsx` do App Router. Usa a classe `.skel` do kit (ifp-components.css,
 * animação ifp-shimmer) — NÃO inventa animação. Como não há layout.tsx (o shell é
 * renderizado dentro de cada página), o skeleton é auto-contido com `.ifp-kit` +
 * `data-unit` pra herdar os tokens (acento laranja). Leve de propósito: cabeçalho
 * + N cartões; sem auth()/db, pra aparecer instantaneamente.
 */
export function PageSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div
      className="ifp-kit"
      data-unit="capacitacao"
      data-unit-accent
      aria-busy="true"
      aria-live="polite"
      style={{ padding: "28px 32px" }}
    >
      <span className="sr-only">Carregando…</span>
      <div className="page-head" aria-hidden="true">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span className="skel" style={{ width: 140, height: 11 }} />
          <span className="skel" style={{ width: 220, height: 30 }} />
          <span className="skel" style={{ width: 360, height: 14, maxWidth: "60vw" }} />
        </div>
      </div>
      <div className={styles.cards} aria-hidden="true" style={{ marginTop: 8 }}>
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="card" style={{ padding: 16 }}>
            <span className="skel" style={{ display: "block", width: 80, height: 10 }} />
            <span
              className="skel"
              style={{ display: "block", width: "70%", height: 18, marginTop: 10 }}
            />
            <span
              className="skel"
              style={{ display: "block", width: "100%", height: 12, marginTop: 12 }}
            />
            <span
              className="skel"
              style={{ display: "block", width: "90%", height: 12, marginTop: 6 }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
