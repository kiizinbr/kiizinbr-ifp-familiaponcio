import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { iniciaisDe } from "@/lib/iniciais";
import { ShellInterno } from "@/components/casa";

/** Guard único de toda a área /educacional/*. */
const PERFIS_PERMITIDOS = ["SUPER_ADMIN", "GESTOR_UNIDADE", "PROFISSIONAL"];
const ROTAS_PRONTAS = ["/educacional", "/educacional/comunicados"];

export default async function EducacionalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login?callbackUrl=/educacional");
  }

  const autorizado = session.perfis?.some((p) => PERFIS_PERMITIDOS.includes(p));
  if (!autorizado) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-foreground">Acesso restrito</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Esta área é exclusiva da equipe do Centro Educacional. Se você acha que isso
          é um engano, fale com o administrador.
        </p>
      </main>
    );
  }

  const nome = session.user?.name ?? session.user?.email ?? "Profissional";
  return (
    <ShellInterno
      modulo="educacional"
      user={nome}
      cargo="Centro Educacional"
      iniciais={iniciaisDe(nome)}
      habilitadas={ROTAS_PRONTAS}
    >
      {children}
    </ShellInterno>
  );
}
