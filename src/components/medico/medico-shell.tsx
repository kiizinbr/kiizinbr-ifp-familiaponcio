import type { Session } from "next-auth";
import { AppShell } from "@/components/app-shell";
import { medicoNavItems } from "@/lib/medico/nav";

/**
 * Shell do Centro Médico: AppShell com nav contextual + accent teal da unidade.
 * Fonte única pra todas as telas /medico/* não repetirem a fiação de navegação.
 */
export function MedicoShell({
  session,
  children,
}: {
  session: Session;
  children: React.ReactNode;
}) {
  return (
    <AppShell
      session={session}
      items={medicoNavItems(session)}
      sectionLabel="Centro Médico"
      sectionColor="rgb(var(--ifp-teal-700))"
    >
      {children}
    </AppShell>
  );
}

/**
 * Cabeçalho padrão das telas médicas: eyebrow + título + (ação opcional à direita).
 * Mantém ritmo tipográfico consistente entre as 8 telas.
 */
export function MedicoHeader({
  eyebrow,
  titulo,
  descricao,
  acao,
}: {
  eyebrow?: string;
  titulo: string;
  descricao?: string;
  acao?: React.ReactNode;
}) {
  return (
    <header className="mb-8 flex items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p
            className="text-[11px] font-bold tracking-[0.14em] uppercase"
            style={{ color: "rgb(var(--ifp-teal-700))" }}
          >
            {eyebrow}
          </p>
        )}
        <h1
          className="mt-1.5 text-[2rem] leading-tight font-extrabold tracking-tight"
          style={{ color: "rgb(var(--ifp-ink))" }}
        >
          {titulo}
        </h1>
        {descricao && (
          <p className="mt-2 max-w-xl text-sm" style={{ color: "rgb(var(--ifp-muted))" }}>
            {descricao}
          </p>
        )}
      </div>
      {acao && <div className="shrink-0">{acao}</div>}
    </header>
  );
}
