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

/** Cor do ponto no trilho, por tipo de evento. */
const DOT_COLOR: Record<HistoryEventAction, string> = {
  ficha_created: "bg-emerald-500",
  ficha_updated: "bg-sky-500",
  anexo_uploaded: "bg-[rgb(var(--ifp-orange-500))]",
  anexo_removed: "bg-red-500",
  triagem_aberta: "bg-violet-500",
  triagem_concluida: "bg-violet-700",
  elegibilidade_decidida: "bg-amber-500",
  agendamento_criado: "bg-sky-400",
  agendamento_realizado: "bg-emerald-600",
  outro: "bg-slate-400",
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
          className="text-xs text-[rgb(var(--ifp-muted))] hover:text-[rgb(var(--ifp-orange-500))]"
        >
          ← Voltar para a Ficha
        </Link>
        <h1 className="mt-4 text-3xl font-semibold text-[rgb(var(--ifp-ink))]">Histórico</h1>
        <p className="mt-1 text-sm text-[rgb(var(--ifp-muted))]">
          Linha do tempo de eventos da ficha de{" "}
          <span className="font-medium">{cidadao.nomeCompleto}</span>.
        </p>
      </header>

      <section className="ifp-card p-6">
        {timeline.length === 0 ? (
          <p className="text-sm text-[rgb(var(--ifp-muted))]">Nenhum evento registrado.</p>
        ) : (
          <ol className="relative space-y-6 border-l border-slate-200 pl-6">
            {timeline.map((evento) => (
              <li key={evento.id} className="relative">
                <span
                  className={`absolute top-1 -left-[1.7rem] h-3 w-3 rounded-full ring-4 ring-white ${DOT_COLOR[evento.action]}`}
                  aria-hidden
                />
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-sm font-medium text-[rgb(var(--ifp-ink))]">
                    {evento.label}
                  </span>
                  {evento.detalhe && (
                    <span className="text-sm text-[rgb(var(--ifp-muted))]">— {evento.detalhe}</span>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-[rgb(var(--ifp-muted))]">
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
