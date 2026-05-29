import type { Route } from "next";
import Link from "next/link";
import Image from "next/image";
import { UNIDADES } from "@/lib/unidades";

const UNIDADES_PUBLICAS = ["medico", "capacitacao", "esportivo", "recreativo"] as const;

export default function LandingPage() {
  return (
    <main className="min-h-screen" style={{ backgroundColor: "rgb(var(--ifp-canvas))" }}>
      <header
        className="mx-auto flex max-w-5xl items-center justify-between"
        style={{ padding: "var(--ifp-space-8) var(--ifp-space-6)" }}
      >
        <div className="flex items-center gap-3">
          <Image
            src="/logo/ifp-symbol.png"
            alt="Instituto Família Pôncio"
            width={48}
            height={48}
            priority
          />
          <span
            className="text-lg font-bold tracking-tight"
            style={{ color: "rgb(var(--ifp-ink))" }}
          >
            Instituto Família Pôncio
          </span>
        </div>
        <Link
          href={"/poncio/login" as Route}
          className="text-sm transition-opacity hover:opacity-70"
          style={{ color: "rgb(var(--ifp-muted))" }}
        >
          Acesso executivo
        </Link>
      </header>

      <section
        className="mx-auto max-w-5xl"
        style={{ padding: "var(--ifp-space-12) var(--ifp-space-6)" }}
      >
        <h1
          className="text-4xl font-bold tracking-tight"
          style={{ color: "rgb(var(--ifp-orange-900))" }}
        >
          Quatro unidades. Um propósito.
        </h1>
        <p className="mt-4 max-w-2xl text-lg" style={{ color: "rgb(var(--ifp-ink))" }}>
          O Instituto Família Pôncio atende moradores de Duque de Caxias através de quatro frentes:
          saúde, educação, esporte e recreação infantil.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {UNIDADES_PUBLICAS.map((slug) => {
            const u = UNIDADES[slug];
            return (
              <Link
                key={slug}
                href={`/${slug}/login` as Route}
                className="group transition-all hover:-translate-y-0.5 hover:shadow-md"
                style={{
                  padding: "var(--ifp-space-6)",
                  backgroundColor: "rgb(var(--ifp-canvas))",
                  border: "1px solid rgb(var(--ifp-surface-200))",
                  borderTop: `4px solid ${u.corFiltroLogin}`,
                  borderRadius: "var(--ifp-radius-lg)",
                  boxShadow: "var(--ifp-shadow-sm)",
                }}
              >
                <h2 className="text-xl font-bold" style={{ color: "rgb(var(--ifp-ink))" }}>
                  {u.nome}
                </h2>
                <p className="mt-2 text-sm" style={{ color: "rgb(var(--ifp-muted))" }}>
                  Acesso da equipe da unidade
                </p>
                <span
                  className="mt-4 inline-block text-sm font-bold"
                  style={{ color: "rgb(var(--ifp-orange-700))" }}
                >
                  Entrar →
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <footer
        className="border-t py-8 text-center text-xs"
        style={{
          borderColor: "rgb(var(--ifp-surface-200))",
          color: "rgb(var(--ifp-muted))",
        }}
      >
        © {new Date().getFullYear()} Instituto Família Pôncio · Duque de Caxias, RJ
      </footer>
    </main>
  );
}
