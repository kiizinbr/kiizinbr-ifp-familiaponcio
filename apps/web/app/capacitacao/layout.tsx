import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { iniciaisDe } from "@/lib/iniciais";
import { AcessoRestrito, ShellInterno } from "@/components/casa";

/** Guard único de toda a área /capacitacao/*. */
const PERFIS_PERMITIDOS = ["SUPER_ADMIN", "PROFISSIONAL", "GESTOR_UNIDADE"];
const ROTAS_PRONTAS = [
  "/capacitacao",
  "/capacitacao/turmas",
  "/capacitacao/cursos",
  "/capacitacao/matriculas",
  "/capacitacao/certificados",
  "/capacitacao/indicadores",
];

export default async function CapacitacaoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login?callbackUrl=/capacitacao");
  }

  const autorizado = session.perfis?.some((p) => PERFIS_PERMITIDOS.includes(p));
  if (!autorizado) {
    return (
      <AcessoRestrito mensagem="Esta área é exclusiva da equipe do Centro de Capacitação. Se você acha que isso é um engano, fale com o administrador." />
    );
  }

  const nome = session.user?.name ?? session.user?.email ?? "Profissional";
  return (
    <ShellInterno
      modulo="capacitacao"
      user={nome}
      cargo="Centro de Capacitação"
      iniciais={iniciaisDe(nome)}
      habilitadas={ROTAS_PRONTAS}
    >
      {children}
    </ShellInterno>
  );
}
