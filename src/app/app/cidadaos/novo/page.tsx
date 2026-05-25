import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { hasAnyRole } from "@/lib/rbac";
import type { UnitScope } from "@/lib/rbac-types";
import { NovoCidadaoForm } from "./form";

export default async function NovoCidadaoPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // RBAC: só quem pode criar Ficha vê esta página
  const canCreate = hasAnyRole(
    session,
    "super_admin",
    "gestor_geral",
    "gestor_unidade",
    "profissional",
    "recepcao",
  );
  if (!canCreate) redirect("/app/cidadaos");

  // Default da unidade = primaryUnitScope do user (recepção/profissional/gestor_unidade
  // tem 1 unidade), ou "medico" como fallback pra super/gestor_geral
  const defaultUnit: UnitScope = (session.user.primaryRole?.unitScope as UnitScope) ?? "medico";

  // Super_admin + gestor_geral podem escolher qualquer unidade
  const canChooseUnit = hasAnyRole(session, "super_admin", "gestor_geral");

  return (
    <AppShell session={session}>
      <header className="mb-6">
        <p className="text-xs tracking-widest text-[rgb(var(--ifp-muted))] uppercase">Cadastro</p>
        <h1 className="mt-1 text-3xl font-semibold text-[rgb(var(--ifp-ink))]">Novo cidadão</h1>
        <p className="mt-2 text-sm text-[rgb(var(--ifp-muted))]">
          Preencha pelo menos os campos obrigatórios das abas Identificação e Contato. O resto pode
          ser completado depois pela equipe.
        </p>
      </header>

      <NovoCidadaoForm defaultUnit={defaultUnit} canChooseUnit={canChooseUnit} />
    </AppShell>
  );
}
