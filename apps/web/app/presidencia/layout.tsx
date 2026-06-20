import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { ShellInterno } from "@/components/casa";

/** Guard único de toda a área /presidencia/*. */
const PERFIS_PERMITIDOS = ["SUPER_ADMIN", "PRESIDENCIA"];

/** Rotas da presidência que já existem (as demais aparecem como "em breve"). */
const ROTAS_PRONTAS = [
  "/presidencia",
  "/presidencia/unidades",
  "/presidencia/impacto",
  "/presidencia/familias",
  "/presidencia/jornada",
];

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  return (
    (partes[0]?.[0] ?? "") + (partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? "") : "")
  ).toUpperCase();
}

export default async function PresidenciaLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login?callbackUrl=/presidencia");
  }

  const autorizado = session.perfis?.some((p) => PERFIS_PERMITIDOS.includes(p));
  if (!autorizado) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-foreground">Acesso restrito</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          A Sala de Comando é exclusiva da Presidência. Se você acha que isso é um engano,
          fale com o administrador.
        </p>
      </main>
    );
  }

  const nome = session.user?.name ?? session.user?.email ?? "Presidência";
  return (
    <ShellInterno
      modulo="presidencia"
      user={nome}
      cargo="Sala de Comando"
      iniciais={iniciais(nome)}
      habilitadas={ROTAS_PRONTAS}
    >
      {children}
    </ShellInterno>
  );
}
