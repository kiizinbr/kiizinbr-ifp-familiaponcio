import { redirect } from "next/navigation";

/**
 * Rota legada. O painel cross-unidade ("Início") mudou de /app para /inicio em
 * 2026-06-08 (doc docs/ux-navegacao-ia-2026-06-08.md). Mantida como redirect para
 * não quebrar bookmarks; as sub-rotas /app/cidadaos e /app/vagas seguem ativas.
 */
export default function AppRootRedirect() {
  redirect("/inicio");
}
