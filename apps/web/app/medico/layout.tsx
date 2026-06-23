import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { AcessoRestrito, ShellInterno } from "@/components/casa";

/** Guard único de toda a área /medico/*. */
const PERFIS_PERMITIDOS = ["SUPER_ADMIN", "PROFISSIONAL", "GESTOR_UNIDADE", "RECEPCAO"];

/** Rotas do médico que já existem (as demais aparecem como "em breve" no rail). */
const ROTAS_PRONTAS = [
  "/medico/agenda",
  "/medico/fila",
  "/medico/fila-chegada",
  "/medico/beneficiarios",
  "/medico/prontuarios",
  "/medico/indicadores",
  "/medico/equipe",
];

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? "") : "")).toUpperCase();
}

export default async function MedicoLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login?callbackUrl=/medico");
  }

  const autorizado = session.perfis?.some((p) => PERFIS_PERMITIDOS.includes(p));
  if (!autorizado) {
    return (
      <AcessoRestrito mensagem="Esta área é exclusiva dos profissionais do Centro Médico. Se você acha que isso é um engano, fale com o administrador." />
    );
  }

  const nome = session.user?.name ?? session.user?.email ?? "Profissional";
  return (
    <ShellInterno
      modulo="medico"
      user={nome}
      cargo="Centro Médico"
      iniciais={iniciais(nome)}
      habilitadas={ROTAS_PRONTAS}
    >
      {children}
    </ShellInterno>
  );
}
