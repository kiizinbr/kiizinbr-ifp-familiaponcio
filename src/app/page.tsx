import type { Route } from "next";
import Link from "next/link";
import Image from "next/image";
import { UNIDADES } from "@/lib/unidades";

const UNIDADES_PUBLICAS = ["medico", "capacitacao", "esportivo", "recreativo"] as const;

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-8">
        <div className="flex items-center gap-3">
          <Image
            src="/logo/leao.png"
            alt="Instituto Família Pôncio"
            width={48}
            height={48}
            priority
          />
          <span className="text-lg font-semibold tracking-tight">Instituto Família Pôncio</span>
        </div>
        <Link
          href={"/poncio/login" as Route}
          className="text-sm text-stone-500 hover:text-stone-900"
        >
          Acesso executivo
        </Link>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-4xl font-semibold tracking-tight text-stone-900">
          Quatro unidades. Um propósito.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-stone-600">
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
                className="group rounded-2xl border border-stone-200 p-6 transition-all hover:border-stone-400 hover:shadow-sm"
                style={{ borderTop: `4px solid ${u.corPrimariaPlaceholder}` }}
              >
                <h2 className="text-xl font-semibold text-stone-900">{u.nome}</h2>
                <p className="mt-2 text-sm text-stone-500">Acesso da equipe da unidade</p>
                <span className="mt-4 inline-block text-sm font-medium text-stone-700 group-hover:text-stone-900">
                  Entrar →
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <footer className="border-t border-stone-100 py-8 text-center text-xs text-stone-400">
        © {new Date().getFullYear()} Instituto Família Pôncio · Duque de Caxias, RJ
      </footer>
    </main>
  );
}
