import Link from "next/link";

export default function NotFound() {
  return (
    <main
      className="ifp-kit"
      style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "var(--sp-6)" }}
    >
      <div style={{ width: "100%", maxWidth: 420, textAlign: "center" }}>
        {/* faixa de identidade das unidades (cores de dado, mantidas do brandbook) */}
        <div
          aria-hidden
          style={{
            margin: "0 auto var(--sp-6)",
            display: "flex",
            height: 4,
            width: 64,
            overflow: "hidden",
            borderRadius: "var(--r-full)",
          }}
        >
          <span style={{ flex: 1, background: "rgb(var(--ifp-filter-medico))" }} />
          <span style={{ flex: 1, background: "rgb(var(--ifp-filter-capacitacao))" }} />
          <span style={{ flex: 1, background: "rgb(var(--ifp-filter-esportivo))" }} />
          <span style={{ flex: 1, background: "rgb(var(--ifp-filter-recreativo))" }} />
        </div>
        <h1 className="t-display" style={{ color: "var(--text)" }}>
          404
        </h1>
        <p style={{ color: "var(--text-3)", marginTop: "var(--sp-2)", fontSize: 14 }}>
          A página que você procurou não existe ou foi movida.
        </p>
        <Link
          href="/app"
          className="btn btn-primary"
          style={{ marginTop: "var(--sp-6)", display: "inline-flex" }}
        >
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}
