import type { Session } from "next-auth";
import { AppShell } from "@/components/app-shell";
import { medicoNavItems, medicoNavGroups } from "@/lib/medico/nav";

/**
 * Shell do Centro Médico: AppShell com nav contextual AGRUPADA (wayfinding —
 * .sb-group por intenção) + accent teal da unidade. Fonte única pra todas as
 * telas /medico/* não repetirem a fiação de navegação. `items` segue como
 * fallback (nav mobile/desktop usa `groups` quando presente).
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
      groups={medicoNavGroups(session)}
      sectionLabel="Centro Médico"
      unit="medico"
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
    <header
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 16,
        marginBottom: 24,
      }}
    >
      <div>
        {eyebrow && (
          <p className="micro" style={{ color: "var(--accent)", marginBottom: 7 }}>
            {eyebrow}
          </p>
        )}
        <h1 className="t-h1" style={{ color: "var(--text)" }}>
          {titulo}
        </h1>
        {descricao && (
          <p
            style={{
              marginTop: 8,
              maxWidth: "60ch",
              fontSize: 13.5,
              color: "var(--text-3)",
              lineHeight: 1.55,
            }}
          >
            {descricao}
          </p>
        )}
      </div>
      {acao && <div style={{ flexShrink: 0 }}>{acao}</div>}
    </header>
  );
}
