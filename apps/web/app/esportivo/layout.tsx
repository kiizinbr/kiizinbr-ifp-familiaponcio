import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { iniciaisDe } from "@/lib/iniciais";
import { AcessoRestrito, ShellInterno } from "@/components/casa";

/** Guard único de toda a área /esportivo/*. */
const PERFIS_PERMITIDOS = ["SUPER_ADMIN", "GESTOR_UNIDADE", "PROFISSIONAL"];
/** Rotas do esportivo que já existem (as demais aparecem como "em breve" no rail). */
const ROTAS_PRONTAS = ["/esportivo", "/esportivo/turmas", "/esportivo/indicadores"];

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
      <AcessoRestrito mensagem="Esta área é exclusiva da equipe do Centro Esportivo. Se você acha que isso é um engano, fale com o administrador." />
    );
  }

  const nome = session.user?.name ?? session.user?.email ?? "Profissional";
  return (
    <ShellInterno
      modulo="esportivo"
      user={nome}
      cargo="Centro Esportivo"
      iniciais={iniciaisDe(nome)}
      habilitadas={ROTAS_PRONTAS}
    >
      {children}
    </ShellInterno>
  );
}
