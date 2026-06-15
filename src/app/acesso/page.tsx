import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TemaUnidade } from "@/components/tema-unidade";
import { auth } from "@/lib/auth";
import { getLandingPath } from "@/lib/rbac";
import { UNIDADE_SLUGS, UNIDADES, type UnidadeConfig } from "@/lib/unidades";

export const metadata: Metadata = {
  title: "Acesso ao Sistema · IFP Connect",
};

/**
 * Funil de acesso por unidade (direção CASA): a pessoa escolhe o "salão"
 * antes do login → /login?unidade=<slug> já chega tematizado.
 *
 * Rota PÚBLICA (fora do matcher do proxy, como /login). Os dados dos cards
 * vêm inteiros do mapa canônico src/lib/unidades.ts — nada inventado aqui.
 * Agrupamento derivado do próprio mapa: cidadaoScope "self" = unidades de
 * atendimento (cards grandes); "all" = transversais/executivas (compactos).
 */
const TODAS = UNIDADE_SLUGS.map((slug) => UNIDADES[slug]);
const ATENDIMENTO = TODAS.filter((u) => u.cidadaoScope === "self");
const TRANSVERSAIS = TODAS.filter((u) => u.cidadaoScope === "all");

function SetaDireita({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function CardUnidade({ unidade }: { unidade: UnidadeConfig }) {
  return (
    <TemaUnidade tema={unidade.slug}>
      <Link
        // Funil aponta direto pra rota POR UNIDADE (/<slug>/login), que faz o
        // pré-flight de acesso e o redirect pra /<slug>. Aposenta o /login?unidade=
        // genérico (cujo hidden o signInAction ignorava — F22) e mata o vetor de
        // "loga no salão errado" de graça (a verificação vem do unidadeLoginAction).
        href={`/${unidade.slug}/login` as Route}
        className="group border-border bg-surface shadow-ifp-sm hover:border-primary/60 hover:shadow-casa-sm block rounded-lg border p-5 transition"
      >
        <div className="bg-unidade mb-3 h-2 w-12 rounded-full" aria-hidden />
        <h2 className="text-foreground group-hover:text-primary flex items-center gap-1.5 text-lg font-semibold transition">
          {unidade.nome}
          <SetaDireita className="opacity-0 transition group-hover:opacity-100" />
        </h2>
        {unidade.tagline && <p className="text-muted-foreground mt-1 text-sm">{unidade.tagline}</p>}
      </Link>
    </TemaUnidade>
  );
}

function CardTransversal({ unidade }: { unidade: UnidadeConfig }) {
  return (
    <TemaUnidade tema={unidade.slug}>
      <Link
        // Idem CardUnidade: rota por unidade com pré-flight (F22).
        href={`/${unidade.slug}/login` as Route}
        className="group border-border bg-surface shadow-ifp-sm hover:border-primary/60 flex items-center justify-between gap-4 rounded-lg border px-5 py-4 transition"
      >
        <span>
          <span className="text-foreground group-hover:text-primary block text-sm font-semibold transition">
            {unidade.nome}
          </span>
          {unidade.tagline && (
            <span className="text-muted-foreground mt-0.5 block text-xs">{unidade.tagline}</span>
          )}
        </span>
        <SetaDireita className="text-muted-foreground group-hover:text-primary shrink-0 transition" />
      </Link>
    </TemaUnidade>
  );
}

export default async function AcessoPage() {
  // Funil público de acesso: quem já está logado não escolhe salão de novo —
  // vai direto pro seu destino. Mesmo guard do /login (F21); `home !== "/login"`
  // só por segurança (getLandingPath não devolve /login pra sessão válida — B3).
  const session = await auth();
  if (session) {
    const home = getLandingPath(session);
    if (home !== "/login") redirect(home as Route);
  }

  return (
    <main className="bg-background min-h-screen">
      <div className="mx-auto w-full max-w-3xl px-6 py-12 md:py-16">
        <Link href="/" className="text-muted-foreground hover:text-foreground text-sm transition">
          ← Instituto Família Pôncio
        </Link>

        <header className="mt-8 mb-10">
          <p className="micro">IFP Connect</p>
          <h1 className="font-display text-tinta mt-2 text-3xl font-bold tracking-tight md:text-4xl">
            Acesso ao Sistema
          </h1>
          <p className="text-muted-foreground mt-2 text-base">
            Em qual unidade você vai entrar hoje?
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          {ATENDIMENTO.map((u) => (
            <CardUnidade key={u.slug} unidade={u} />
          ))}
        </div>

        <p className="text-muted-foreground mt-10 mb-3 text-xs font-semibold tracking-wider uppercase">
          Gestão e áreas transversais
        </p>
        <div className="grid gap-3">
          {TRANSVERSAIS.map((u) => (
            <CardTransversal key={u.slug} unidade={u} />
          ))}
        </div>
      </div>
    </main>
  );
}
