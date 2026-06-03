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
  aberta: "badge badge-success",
  pausada: "badge badge-warning",
  encerrada: "badge badge-default",
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
          <p className="micro">Captação</p>
          <h1 className="t-h1 mt-1">Vagas</h1>
          <p className="mt-2 text-sm text-[var(--text-3)]">
            {vagas.length} {vagas.length === 1 ? "vaga" : "vagas"} · entrevistas de triagem por
            unidade.
          </p>
        </div>
        {podeCriar && (
          <Link href={"/app/vagas/nova" as Route} className="btn btn-primary">
            + Nova vaga
          </Link>
        )}
      </header>

      {vagas.length === 0 ? (
        <div className="card p-10 text-center text-sm text-[var(--text-3)]">
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
                className="card card-hover block p-5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="h-2 w-8 rounded"
                    style={{ background: `rgb(var(--ifp-filter-${v.unidade}))` }}
                  />
                  <span className={STATUS_BADGE[v.status]}>{v.status}</span>
                </div>
                <h2 className="t-h3 mt-3">{v.titulo}</h2>
                <p className="text-sm text-[var(--text-3)]">
                  {UNIT_LABELS[v.unidade as UnitScope]}
                </p>
                <p className="mt-4 text-sm">
                  <span className="mono text-2xl font-bold tracking-tight text-[var(--text)]">
                    {disp}
                  </span>
                  <span className="text-[var(--text-3)]"> de {v.slotsTotais} slots livres</span>
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
