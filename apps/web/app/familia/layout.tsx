import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { SairButton } from "@/components/sair-button";
import { Brandmark } from "@/components/casa";
import { BottomNavFamilia } from "@/components/casa/BottomNavFamilia";

/**
 * Portal da família — exclusivo do responsável. Mobile-first, máximo 3 telas:
 * Diário · Comunicados · Minha criança. Identidade CASA (leão + cor da unidade),
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

  const nome = session.user?.name ?? "Família";
  return (
    <div data-theme="educacional" className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 bg-primary text-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.6)]">
            <Brandmark size={24} title="IFP" />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold">Minha família</div>
            <div className="text-[11px] opacity-85">{nome}</div>
          </div>
          <div className="ml-auto">
            <SairButton />
          </div>
        </div>
      </header>

      <div className="flex-1 pb-24">{children}</div>

      <BottomNavFamilia />
    </div>
  );
}
