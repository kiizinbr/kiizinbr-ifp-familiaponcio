import Link from "next/link";
import { ShieldAlert } from "lucide-react";

/**
 * Tela 403 padrão do CASA. Os guards de cada área (layout.tsx) renderizam isto
 * quando o perfil logado não tem permissão — antes o bloco vivia copiado e colado
 * em cada layout. A mensagem é customizável por área.
 */
export function AcessoRestrito({ mensagem }: { mensagem?: string }) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
      <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-warning/40 bg-[var(--ifp-ambar-bg)] text-warning">
        <ShieldAlert className="h-8 w-8" />
      </span>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Erro 403
      </p>
      <h1 className="mt-2 text-2xl font-bold text-foreground">Acesso restrito</h1>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">
        {mensagem ??
          "Você não tem permissão para acessar esta área. Se acha que isso é um engano, fale com o administrador."}
      </p>
      <Link
        href="/"
        className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
      >
        Voltar ao início
      </Link>
    </main>
  );
}
