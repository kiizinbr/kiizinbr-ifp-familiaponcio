import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Baby, BellRing, BookOpen } from "lucide-react";

import { authOptions } from "@/lib/auth";
import { SairButton } from "@/components/sair-button";

/**
 * Portal da família — exclusivo do responsável. Máximo 3 telas (pesquisa):
 * Diário · Comunicados · Minha criança. Navegação por ícones grandes,
 * tom mais quente que o console da equipe.
 */
const PERFIS_PERMITIDOS = ["RESPONSAVEL_FAMILIAR"];

export default async function FamiliaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login?callbackUrl=/familia");
  }

  const autorizado = session.perfis?.some((p) => PERFIS_PERMITIDOS.includes(p));
  if (!autorizado) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-foreground">Acesso restrito</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Esta área é exclusiva dos responsáveis das crianças. Se você acha que isso é
          um engano, fale com a secretaria do instituto.
        </p>
      </main>
    );
  }

  return (
    <div data-theme="educacional" className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link href="/familia/diario" className="flex items-baseline gap-2">
            <span className="text-xs uppercase tracking-widest text-primary">IFP</span>
            <span className="text-sm font-semibold text-foreground">Minha família</span>
          </Link>
          <SairButton />
        </div>
      </header>

      <div className="flex-1 pb-20">{children}</div>

      {/* Navegação fixa de 3 ícones grandes (mobile-first) */}
      <nav className="fixed inset-x-0 bottom-0 border-t border-border bg-surface">
        <div className="mx-auto grid max-w-2xl grid-cols-3">
          <Link
            href="/familia/diario"
            className="flex flex-col items-center gap-1 py-3 text-xs font-semibold text-muted-foreground transition hover:text-primary"
          >
            <BookOpen className="h-6 w-6" />
            Diário
          </Link>
          <Link
            href="/familia/comunicados"
            className="flex flex-col items-center gap-1 py-3 text-xs font-semibold text-muted-foreground transition hover:text-primary"
          >
            <BellRing className="h-6 w-6" />
            Comunicados
          </Link>
          <Link
            href="/familia/crianca"
            className="flex flex-col items-center gap-1 py-3 text-xs font-semibold text-muted-foreground transition hover:text-primary"
          >
            <Baby className="h-6 w-6" />
            Minha criança
          </Link>
        </div>
      </nav>
    </div>
  );
}
