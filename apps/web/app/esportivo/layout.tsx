import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { SairButton } from "@/components/sair-button";

/** Guard único de toda a área /esportivo/* (console da equipe — visual sóbrio). */
const PERFIS_PERMITIDOS = ["SUPER_ADMIN", "GESTOR_UNIDADE", "PROFISSIONAL"];

export default async function EsportivoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login?callbackUrl=/esportivo");
  }

  const autorizado = session.perfis?.some((p) => PERFIS_PERMITIDOS.includes(p));
  if (!autorizado) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-foreground">Acesso restrito</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Esta área é exclusiva da equipe do Centro Esportivo. Se você acha que isso
          é um engano, fale com o administrador.
        </p>
      </main>
    );
  }

  return (
    // data-theme troca o trio --unidade/* → terracota profundo do Esportivo
    <div data-theme="esportivo" className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/esportivo" className="flex items-baseline gap-2">
            <span className="text-xs uppercase tracking-widest text-primary">
              IFP Connect
            </span>
            <span className="text-sm font-semibold text-foreground">
              Centro Esportivo
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {session.user?.name ?? session.user?.email}
            </span>
            <SairButton />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
