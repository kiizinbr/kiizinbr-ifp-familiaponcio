import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { AcessoRestrito, ShellInterno } from "@/components/casa";

/** Guard único de toda a área /admin/*. */
const PERFIS_PERMITIDOS = ["SUPER_ADMIN", "GESTOR_UNIDADE"];

/**
 * Rotas do admin que já existem (as demais aparecem como "em breve" no rail).
 * Auditoria/Unidades/Comunicados são exclusivas do SUPER_ADMIN (o backend
 * devolve 403 para gestor; aqui só liberamos o item do rail para o admin).
 */
const ROTAS_BASE = ["/admin/usuarios"];
const ROTAS_SUPER_ADMIN = [
  "/admin/auditoria",
  "/admin/unidades",
  "/admin/comunicados",
  "/admin/config",
];

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
      <AcessoRestrito mensagem="Esta área é exclusiva da administração. Se você acha que isso é um engano, fale com o Super Admin." />
    );
  }

  const nome = session.user?.name ?? session.user?.email ?? "Administração";
  const ehSuperAdmin = session.perfis.includes("SUPER_ADMIN");
  const habilitadas = ehSuperAdmin ? [...ROTAS_BASE, ...ROTAS_SUPER_ADMIN] : ROTAS_BASE;
  return (
    <ShellInterno
      modulo="admin"
      user={nome}
      cargo={ehSuperAdmin ? "Administração" : "Gestor de unidade"}
      iniciais={iniciais(nome)}
      habilitadas={habilitadas}
    >
      {children}
    </ShellInterno>
  );
}
