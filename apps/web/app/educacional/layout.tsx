import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { iniciaisDe } from "@/lib/iniciais";
import { AcessoRestrito, ShellInterno } from "@/components/casa";

/** Guard único de toda a área /educacional/*. */
const PERFIS_PERMITIDOS = ["SUPER_ADMIN", "GESTOR_UNIDADE", "PROFISSIONAL"];
const ROTAS_PRONTAS = [
  "/educacional",
  "/educacional/turmas",
  "/educacional/mensagens",
  "/educacional/indicadores",
  "/educacional/comunicados",
];

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
      <AcessoRestrito mensagem="Esta área é exclusiva da equipe do Centro Educacional. Se você acha que isso é um engano, fale com o administrador." />
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
