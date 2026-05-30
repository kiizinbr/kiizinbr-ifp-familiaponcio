import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { SairButton } from "@/components/sair-button";

/** Guard único de toda a área /servico-social/*. */
const PERFIS_PERMITIDOS = ["SUPER_ADMIN", "SERVICO_SOCIAL"];

export default async function ServicoSocialLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login?callbackUrl=/servico-social");
  }

  const autorizado = session.perfis?.some((p) => PERFIS_PERMITIDOS.includes(p));
  if (!autorizado) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-foreground">Acesso restrito</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Esta área é exclusiva da equipe de Serviço Social. Se você acha que isso é um
          engano, fale com o administrador.
        </p>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/servico-social" className="flex items-baseline gap-2">
            <span className="text-xs uppercase tracking-widest text-ifp-orange">
              IFP Connect
            </span>
            <span className="text-sm font-semibold text-foreground">Serviço Social</span>
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
