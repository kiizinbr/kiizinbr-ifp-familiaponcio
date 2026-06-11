/**
 * Acesso ao Sistema — escolha do "salão" (direção CASA).
 * Cada card carrega o data-theme da unidade: a cor já apresenta o salão
 * antes mesmo do login (o /login herda o tema via ?unidade=<slug>).
 */
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { UNIDADES_ACESSO } from "@/lib/unidades";

export const metadata = { title: "Acesso ao Sistema · IFP Connect" };

export default function AcessoPage() {
  const unidades = UNIDADES_ACESSO.filter((u) => u.atendimento);
  const outros = UNIDADES_ACESSO.filter((u) => !u.atendimento);

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Instituto Família Poncio
      </Link>
      <header className="mt-4 mb-10 text-center">
        <p className="text-sm uppercase tracking-widest text-ifp-orange">IFP Connect</p>
        <h1 className="mt-2 text-3xl font-bold text-foreground">Acesso ao Sistema</h1>
        <p className="mt-3 text-muted-foreground">Em qual unidade você vai entrar hoje?</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {unidades.map((u) => (
          <div key={u.slug} data-theme={u.tema}>
            <Link
              href={`/login?unidade=${u.slug}`}
              className="group block rounded-lg border border-border bg-surface p-5 shadow-ifp-sm transition hover:border-primary/60 hover:shadow-casa-sm"
            >
              <div className={`mb-3 h-2 w-12 rounded-full ${u.cor}`} aria-hidden />
              <h2 className="flex items-center gap-1 text-lg font-semibold text-foreground group-hover:text-primary">
                {u.nome}
                <ArrowRight className="h-4 w-4 opacity-0 transition group-hover:opacity-100" />
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{u.descricao}</p>
            </Link>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {outros.map((u) => (
          <div key={u.slug} data-theme={u.tema}>
            <Link
              href={`/login?unidade=${u.slug}`}
              className="group flex items-center justify-between rounded-lg border border-border bg-surface px-5 py-4 transition hover:border-primary/60"
            >
              <div>
                <h2 className="text-sm font-semibold text-foreground group-hover:text-primary">
                  {u.nome}
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">{u.descricao}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:text-primary" />
            </Link>
          </div>
        ))}
      </div>
    </main>
  );
}
