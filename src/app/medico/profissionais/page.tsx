import { redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { db } from "@/lib/db";
import { MedicoShell, MedicoHeader } from "@/components/medico/medico-shell";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { podeGerenciarProfissional } from "@/lib/medico/rbac";

function iniciais(nome: string): string {
  const p = nome
    .replace(/^(Dr\.|Dra\.|Psic\.)\s*/i, "")
    .trim()
    .split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "?";
}

export default async function ProfissionaisPage() {
  const session = await auth();
  if (!session) redirect("/medico/login" as Route);
  if (!canAccessUnidade(session, "medico")) redirect("/" as Route);

  const profs = await db.profissional.findMany({
    include: {
      especialidades: { include: { especialidade: true } },
      _count: { select: { slots: true, consultas: true } },
    },
    orderBy: [{ ativo: "desc" }, { nomeExibicao: "asc" }],
  });

  const podeAdd = podeGerenciarProfissional(session);

  return (
    <MedicoShell session={session}>
      <MedicoHeader
        eyebrow="Equipe"
        titulo="Profissionais"
        descricao="Quem atende no Centro Médico, suas especialidades e conselho de classe."
        acao={
          podeAdd ? (
            <Link
              href={"/medico/profissionais/novo" as Route}
              className="inline-flex items-center gap-2 rounded-[var(--ifp-radius-md)] px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
              style={{ backgroundColor: "rgb(var(--ifp-teal-700))" }}
            >
              + Novo profissional
            </Link>
          ) : undefined
        }
      />

      {profs.length === 0 ? (
        <EmptyState
          titulo="Nenhum profissional cadastrado"
          descricao="Cadastre o primeiro profissional pra começar a montar agendas e marcar consultas."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {profs.map((p) => (
            <Link
              key={p.id}
              href={`/medico/profissionais/${p.id}` as Route}
              className="group flex flex-col rounded-[var(--ifp-radius-lg)] border bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--ifp-shadow-md)]"
              style={{ borderColor: "rgb(var(--ifp-surface-200))", opacity: p.ativo ? 1 : 0.6 }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
                  style={{
                    background:
                      p.especialidades[0]?.especialidade.corDestaque ?? "rgb(var(--ifp-teal-700))",
                  }}
                >
                  {iniciais(p.nomeExibicao)}
                </span>
                <div className="min-w-0">
                  <p
                    className="truncate font-bold transition group-hover:text-[rgb(var(--ifp-teal-700))]"
                    style={{ color: "rgb(var(--ifp-ink))" }}
                  >
                    {p.nomeExibicao}
                  </p>
                  <p className="font-mono text-xs" style={{ color: "rgb(var(--ifp-muted))" }}>
                    {p.conselho} {p.nroConselho}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {p.especialidades.map((pe) => (
                  <span
                    key={pe.especialidadeId}
                    className="rounded px-2 py-0.5 text-[11px] font-medium"
                    style={{
                      background: pe.especialidade.corDestaque + "1f",
                      color: pe.especialidade.corDestaque,
                    }}
                  >
                    {pe.especialidade.nome}
                  </span>
                ))}
              </div>

              <div
                className="mt-4 flex items-center justify-between border-t pt-3 text-xs"
                style={{
                  borderColor: "rgb(var(--ifp-surface-200))",
                  color: "rgb(var(--ifp-muted))",
                }}
              >
                <span>{p._count.slots} slots</span>
                {p.ativo ? (
                  <span style={{ color: "rgb(var(--ifp-teal-700))" }}>Ativo</span>
                ) : (
                  <Badge variant="default">Inativo</Badge>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </MedicoShell>
  );
}
