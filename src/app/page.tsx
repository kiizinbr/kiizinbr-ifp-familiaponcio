import type { Route } from "next";
import Link from "next/link";
import Image from "next/image";
import { UNIDADES } from "@/lib/unidades";

const UNIDADES_PUBLICAS = ["medico", "capacitacao", "esportivo", "recreativo"] as const;

export default function LandingPage() {
  return (
    <main className="ifp-kit" style={{ minHeight: "100vh" }}>
      <header
        className="mx-auto flex items-center justify-between"
        style={{ maxWidth: 1024, padding: "var(--sp-8) var(--sp-6)" }}
      >
        <div className="flex items-center gap-3">
          <span
            style={{
              display: "grid",
              placeItems: "center",
              width: 48,
              height: 48,
              borderRadius: "var(--r-md)",
              background: "var(--logo-bg)",
              border: "1px solid var(--logo-ring)",
              overflow: "hidden",
            }}
          >
            <Image
              src="/logo/ifp-symbol.png"
              alt="Instituto Família Pôncio"
              width={36}
              height={36}
              priority
            />
          </span>
          <span className="t-h3" style={{ color: "var(--text)" }}>
            Instituto Família Pôncio
          </span>
        </div>
        <Link
          href={"/poncio/login" as Route}
          className="t-small"
          style={{ color: "var(--text-3)", textDecoration: "none" }}
        >
          Acesso executivo
        </Link>
      </header>

      <section className="mx-auto" style={{ maxWidth: 1024, padding: "var(--sp-12) var(--sp-6)" }}>
        <p className="micro" style={{ color: "var(--accent)" }}>
          Instituto Família Pôncio
        </p>
        <h1 className="t-display" style={{ color: "var(--text)", marginTop: "var(--sp-2)" }}>
          Quatro unidades. Um propósito.
        </h1>
        <p
          className="t-body"
          style={{ marginTop: "var(--sp-4)", maxWidth: 640, color: "var(--text-2)" }}
        >
          O Instituto Família Pôncio atende moradores de Duque de Caxias através de quatro frentes:
          saúde, educação, esporte e recreação infantil.
        </p>
      </section>

      <section
        className="mx-auto"
        style={{ maxWidth: 1024, padding: "0 var(--sp-6) var(--sp-16)" }}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {UNIDADES_PUBLICAS.map((slug) => {
            const u = UNIDADES[slug];
            return (
              <Link
                key={slug}
                href={`/${slug}/login` as Route}
                className="card card-hover"
                style={{
                  display: "block",
                  padding: "var(--sp-6)",
                  borderTop: `4px solid ${u.corFiltroLogin}`,
                  textDecoration: "none",
                }}
              >
                <h2 className="t-h3" style={{ color: "var(--text)" }}>
                  {u.nome}
                </h2>
                <p className="t-small" style={{ marginTop: "var(--sp-2)", color: "var(--text-3)" }}>
                  Acesso da equipe da unidade
                </p>
                <span
                  style={{
                    marginTop: "var(--sp-4)",
                    display: "inline-block",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--accent)",
                  }}
                >
                  Entrar →
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <footer
        className="text-center"
        style={{
          borderTop: "1px solid var(--line)",
          padding: "var(--sp-8) 0",
        }}
      >
        <p className="micro">
          © {new Date().getFullYear()} Instituto Família Pôncio · Duque de Caxias, RJ
        </p>
      </footer>
    </main>
  );
}
