import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { listVagas, podeAgendar, podeGerenciarVaga, slotsDisponiveis } from "@/lib/funil";
import type { UnitScope } from "@/lib/rbac-types";

const UNIT_LABELS: Record<UnitScope, string> = {
  medico: "Centro Médico",
  capacitacao: "Capacitação",
  esportivo: "Esportivo",
  recreativo: "Recreativo",
};

const STATUS_BADGE: Record<string, string> = {
  aberta: "bg-emerald-100 text-emerald-700",
  pausada: "bg-amber-100 text-amber-700",
  encerrada: "bg-slate-100 text-slate-600",
};

export default async function VagasPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (!podeAgendar(session)) notFound();

  const vagas = await listVagas(session);
  const podeCriar = podeGerenciarVaga(session);

  return (
    <AppShell session={session}>
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-widest text-[rgb(var(--ifp-muted))] uppercase">Captação</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Vagas</h1>
          <p className="mt-2 text-sm text-[rgb(var(--ifp-muted))]">
            {vagas.length} {vagas.length === 1 ? "vaga" : "vagas"} · entrevistas de triagem por
            unidade.
          </p>
        </div>
        {podeCriar && (
          <Link
            href={"/app/vagas/nova" as Route}
            className="rounded-full bg-[rgb(var(--ifp-orange-500))] px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5"
          >
            + Nova vaga
          </Link>
        )}
      </header>

      {vagas.length === 0 ? (
        <div className="ifp-card p-10 text-center text-sm text-[rgb(var(--ifp-muted))]">
          Nenhuma vaga ainda.{podeCriar && " Crie a primeira com “+ Nova vaga”."}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vagas.map((v) => {
            const disp = slotsDisponiveis(v.slotsTotais, v.agendamentos);
            return (
              <Link
                key={v.id}
                href={`/app/vagas/${v.id}` as Route}
                className="ifp-card ifp-card-hover block p-5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="h-2 w-8 rounded"
                    style={{ background: `rgb(var(--ifp-filter-${v.unidade}))` }}
                  />
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[v.status]}`}
                  >
                    {v.status}
                  </span>
                </div>
                <h2 className="mt-3 text-base font-semibold">{v.titulo}</h2>
                <p className="text-sm text-[rgb(var(--ifp-muted))]">
                  {UNIT_LABELS[v.unidade as UnitScope]}
                </p>
                <p className="mt-4 text-sm">
                  <span className="text-2xl font-bold tracking-tight">{disp}</span>
                  <span className="text-[rgb(var(--ifp-muted))]">
                    {" "}
                    de {v.slotsTotais} slots livres
                  </span>
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
