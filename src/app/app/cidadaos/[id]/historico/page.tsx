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
  anexo_uploaded: "bg-[rgb(var(--ifp-laranja))]",
  anexo_removed: "bg-red-500",
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
          className="text-xs text-slate-500 hover:text-[rgb(var(--ifp-laranja))]"
        >
          ← Voltar para a Ficha
        </Link>
        <h1 className="mt-4 text-3xl font-semibold text-slate-900">Histórico</h1>
        <p className="mt-1 text-sm text-slate-600">
          Linha do tempo de eventos da ficha de{" "}
          <span className="font-medium">{cidadao.nomeCompleto}</span>.
        </p>
      </header>

      <section className="rounded-lg border bg-white p-6 shadow-sm">
        {timeline.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum evento registrado.</p>
        ) : (
          <ol className="relative space-y-6 border-l border-slate-200 pl-6">
            {timeline.map((evento) => (
              <li key={evento.id} className="relative">
                <span
                  className={`absolute top-1 -left-[1.7rem] h-3 w-3 rounded-full ring-4 ring-white ${DOT_COLOR[evento.action]}`}
                  aria-hidden
                />
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-sm font-medium text-slate-900">{evento.label}</span>
                  {evento.detalhe && (
                    <span className="text-sm text-slate-600">— {evento.detalhe}</span>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
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
