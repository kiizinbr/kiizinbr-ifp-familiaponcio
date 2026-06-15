import Link from "next/link";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { db } from "@/lib/db";
import { CapacitacaoShell } from "@/components/capacitacao/capacitacao-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { STATUS_TURMA_VISUAL } from "@/lib/capacitacao/ui";
import { podeCriarTurma } from "@/lib/capacitacao/rbac";
import { PageHead, KitBadge } from "../_components/ui";

const ATIVAS = ["inscrito", "confirmado", "cursando"] as const;
const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "2-digit" });

export default async function TurmasPage() {
  const session = await auth();
  if (!session) redirect("/capacitacao/login" as Route);
  if (!canAccessUnidade(session, "capacitacao")) redirect("/" as Route);

  const [turmas, ativasPorTurma] = await Promise.all([
    db.turma.findMany({
      include: { curso: { select: { nome: true } }, instrutor: { select: { nomeExibicao: true } } },
      orderBy: [{ status: "asc" }, { dataInicio: "desc" }],
    }),
    db.matricula.groupBy({
      by: ["turmaId"],
      where: { status: { in: [...ATIVAS] } },
      _count: true,
    }),
  ]);
  const ativasMap = new Map(ativasPorTurma.map((g) => [g.turmaId, g._count]));

  const podeCriar = podeCriarTurma(session);

  return (
    <CapacitacaoShell session={session}>
      <PageHead
        eyebrow="Capacitação · Turmas"
        title="Turmas"
        desc="Instâncias datadas dos cursos, com vagas e matrículas. Abra uma turma para gerenciar inscrições e a lista de espera."
        action={
          podeCriar ? (
            <Link href={"/capacitacao/turmas/nova" as Route} className="btn btn-primary">
              Nova turma
            </Link>
          ) : null
        }
      />

      {turmas.length === 0 ? (
        <EmptyState
          titulo="Nenhuma turma cadastrada"
          descricao="As instâncias datadas dos cursos aparecem aqui. Abra a primeira para começar a matricular."
          cta={
            podeCriar ? (
              <Link href={"/capacitacao/turmas/nova" as Route} className="btn btn-primary btn-sm">
                Abrir a primeira
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="card">
          <header>
            <span className="tick" />
            <h3>TODAS AS TURMAS</h3>
            <span className="act" style={{ cursor: "default", color: "var(--text-3)" }}>
              {turmas.length} no total
            </span>
          </header>
          <div className="table-wrap" style={{ border: 0, borderRadius: 0, boxShadow: "none" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Curso</th>
                  <th>Período</th>
                  <th>Instrutor</th>
                  <th style={{ textAlign: "right" }}>Vagas</th>
                  <th style={{ textAlign: "right" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {turmas.map((t) => {
                  const v = STATUS_TURMA_VISUAL[t.status];
                  const ocupadas = ativasMap.get(t.id) ?? 0;
                  return (
                    <tr key={t.id}>
                      <td>
                        <Link
                          href={`/capacitacao/turmas/${t.id}` as Route}
                          className="cell-strong text-accent"
                          style={{ textDecoration: "none" }}
                        >
                          {t.curso.nome}
                        </Link>
                        <div className="mono text-3" style={{ fontSize: 11, marginTop: 2 }}>
                          {t.codigo}
                        </div>
                      </td>
                      <td className="cell-mono">
                        {fmt.format(t.dataInicio)} – {fmt.format(t.dataFim)}
                      </td>
                      <td style={{ color: "var(--text-3)" }}>{t.instrutor?.nomeExibicao ?? "—"}</td>
                      <td className="cell-mono" style={{ textAlign: "right" }}>
                        {ocupadas}/{t.capacidade}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <KitBadge variant={v.variant}>{v.label}</KitBadge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </CapacitacaoShell>
  );
}
