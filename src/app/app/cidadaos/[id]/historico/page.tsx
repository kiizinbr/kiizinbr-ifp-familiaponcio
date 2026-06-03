import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { getCidadaoHistory, type HistoryEventAction } from "@/lib/cidadao-history";

function formatDateTime(date: Date): string {
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Cor do ponto no trilho, por tipo de evento (paleta categórica de dado). */
const DOT_COLOR: Record<HistoryEventAction, string> = {
  ficha_created: "var(--ok)",
  ficha_updated: "var(--accent)",
  anexo_uploaded: "var(--live)",
  anexo_removed: "var(--danger)",
  triagem_aberta: "#8b5cf6",
  triagem_concluida: "#6d28d9",
  elegibilidade_decidida: "var(--warn)",
  agendamento_criado: "color-mix(in srgb, var(--accent) 70%, var(--surface))",
  agendamento_realizado: "var(--ok)",
  outro: "var(--text-3)",
};

export default async function CidadaoHistoricoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const result = await getCidadaoHistory(id, session);
  if (!result) notFound();

  const { cidadao, timeline } = result;

  return (
    <AppShell session={session}>
      <header className="mb-6">
        <Link
          href={`/app/cidadaos/${cidadao.id}` as Route}
          className="text-xs text-[var(--text-3)] hover:text-[var(--accent)]"
        >
          ← Voltar para a Ficha
        </Link>
        <h1 className="t-h2 mt-4 text-[var(--text)]">Histórico</h1>
        <p className="mt-1 text-sm text-[var(--text-3)]">
          Linha do tempo de eventos da ficha de{" "}
          <span className="font-medium">{cidadao.nomeCompleto}</span>.
        </p>
      </header>

      <section className="card p-6">
        {timeline.length === 0 ? (
          <p className="text-sm text-[var(--text-3)]">Nenhum evento registrado.</p>
        ) : (
          <ol className="relative space-y-6 border-l border-[var(--line)] pl-6">
            {timeline.map((evento) => (
              <li key={evento.id} className="relative">
                <span
                  className="absolute top-1 -left-[1.7rem] h-3 w-3 rounded-full ring-4 ring-[var(--surface)]"
                  style={{ background: DOT_COLOR[evento.action] }}
                  aria-hidden
                />
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-sm font-medium text-[var(--text)]">{evento.label}</span>
                  {evento.detalhe && (
                    <span className="text-sm text-[var(--text-3)]">— {evento.detalhe}</span>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-[var(--text-3)]">
                  <span>{formatDateTime(evento.data)}</span>
                  <span>•</span>
                  <span>{evento.autor}</span>
                  {evento.derivado && (
                    <>
                      <span>•</span>
                      <span
                        className="italic"
                        title="Evento derivado do cadastro (não registrado no audit log)"
                      >
                        derivado do registro
                      </span>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </AppShell>
  );
}
