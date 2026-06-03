import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { hasAnyRole } from "@/lib/rbac";
import type { UnitScope } from "@/lib/rbac-types";
import { NovoCidadaoForm } from "./form";

export default async function NovoCidadaoPage({
  searchParams,
}: {
  searchParams: Promise<{ nome?: string; tel?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  // Pré-preenche quando vindo de um agendamento ("Criar ficha do interessado").
  const sp = await searchParams;
  const initialValues =
    sp.nome || sp.tel
      ? { nomeCompleto: sp.nome ?? "", telefonePrincipal: sp.tel ?? "" }
      : undefined;

  // RBAC: só quem pode criar Ficha vê esta página
  const canCreate = hasAnyRole(
    session,
    "super_admin",
    "gestor_unidade",
    "profissional",
    "recepcao",
  );
  if (!canCreate) redirect("/app/cidadaos");

  // Default da unidade = primaryUnitScope do user (recepção/profissional/gestor_unidade
  // tem 1 unidade), ou "medico" como fallback pra super_admin
  const defaultUnit: UnitScope = (session.user.primaryRole?.unitScope as UnitScope) ?? "medico";

  // Super_admin pode escolher qualquer unidade
  const canChooseUnit = hasAnyRole(session, "super_admin");

  return (
    <AppShell session={session}>
      <header className="mb-6">
        <p className="micro">Cadastro</p>
        <h1 className="t-h1 mt-1 text-[var(--text)]">Novo cidadão</h1>
        <p className="mt-2 text-sm text-[var(--text-3)]">
          Preencha pelo menos os campos obrigatórios das abas Identificação e Contato. O resto pode
          ser completado depois pela equipe.
        </p>
      </header>

      <NovoCidadaoForm
        defaultUnit={defaultUnit}
        canChooseUnit={canChooseUnit}
        initialValues={initialValues}
      />
    </AppShell>
  );
}
