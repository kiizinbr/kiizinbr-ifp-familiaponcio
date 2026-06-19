import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { ShellInterno } from "@/components/casa";

/** Guard único de toda a área /admin/*. */
const PERFIS_PERMITIDOS = ["SUPER_ADMIN", "GESTOR_UNIDADE"];

/** Rotas do admin que já existem (as demais aparecem como "em breve" no rail). */
const ROTAS_PRONTAS = ["/admin/usuarios"];

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  return (
    (partes[0]?.[0] ?? "") +
    (partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? "") : "")
  ).toUpperCase();
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login?callbackUrl=/admin/usuarios");
  }

  const autorizado = session.perfis?.some((p) => PERFIS_PERMITIDOS.includes(p));
  if (!autorizado) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-foreground">Acesso restrito</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Esta área é exclusiva da administração. Se você acha que isso é um engano,
          fale com o Super Admin.
        </p>
      </main>
    );
  }

  const nome = session.user?.name ?? session.user?.email ?? "Administração";
  const ehGestor = !session.perfis.includes("SUPER_ADMIN");
  return (
    <ShellInterno
      modulo="admin"
      user={nome}
      cargo={ehGestor ? "Gestor de unidade" : "Administração"}
      iniciais={iniciais(nome)}
      habilitadas={ROTAS_PRONTAS}
    >
      {children}
    </ShellInterno>
  );
}
