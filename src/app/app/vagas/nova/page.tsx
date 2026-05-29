import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { podeGerenciarVaga } from "@/lib/funil";
import { getUserUnits } from "@/lib/rbac";
import { UNIT_SCOPES, type UnitScope } from "@/lib/rbac-types";
import { VagaForm } from "../vaga-form";

const UNIT_LABELS: Record<UnitScope, string> = {
  medico: "Centro Médico",
  capacitacao: "Centro de Capacitação",
  esportivo: "Centro Esportivo",
  recreativo: "Centro Recreativo",
};

export default async function NovaVagaPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (!podeGerenciarVaga(session)) notFound();

  const units = getUserUnits(session);
  const acessiveis = units === "all" ? UNIT_SCOPES : units;
  const unidades = acessiveis.map((u) => ({ value: u, label: UNIT_LABELS[u] }));

  return (
    <AppShell session={session}>
      <header className="mb-6">
        <Link
          href={"/app/vagas" as Route}
          className="text-xs text-[rgb(var(--ifp-muted))] hover:text-[rgb(var(--ifp-orange-500))]"
        >
          ← Voltar para Vagas
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">Nova vaga</h1>
        <p className="mt-1 text-sm text-[rgb(var(--ifp-muted))]">
          Defina a unidade, a capacidade (slots) e a janela de divulgação.
        </p>
      </header>

      <VagaForm unidades={unidades} />
    </AppShell>
  );
}
