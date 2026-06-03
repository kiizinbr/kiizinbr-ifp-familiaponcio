import type { Session } from "next-auth";
import { AppShell } from "@/components/app-shell";
import { capacitacaoNavItems } from "@/lib/capacitacao/nav";

/**
 * Shell da Capacitação: AppShell com nav contextual + accent laranja da unidade.
 * Espelha o MedicoShell. Fonte única pras telas /capacitacao/*.
 */
export function CapacitacaoShell({
  session,
  children,
}: {
  session: Session;
  children: React.ReactNode;
}) {
  return (
    <AppShell
      session={session}
      items={capacitacaoNavItems(session)}
      sectionLabel="Capacitação"
      unit="capacitacao"
    >
      {children}
    </AppShell>
  );
}
