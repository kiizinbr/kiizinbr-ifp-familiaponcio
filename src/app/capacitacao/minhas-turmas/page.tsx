import Link from "next/link";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { db } from "@/lib/db";
import { CapacitacaoShell } from "@/components/capacitacao/capacitacao-shell";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { STATUS_TURMA_VISUAL } from "@/lib/capacitacao/ui";
import { PageHead } from "../_components/ui";
import styles from "../capacitacao.module.css";

const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

/** Turmas do instrutor logado (F1.A.2). Foco: abrir e registrar a presença da aula. */
export default async function MinhasTurmasPage() {
  const session = await auth();
  if (!session) redirect("/capacitacao/login" as Route);
  if (!canAccessUnidade(session, "capacitacao")) redirect("/" as Route);

  const instrutor = await db.instrutor.findUnique({
    where: { userId: session.user.id },
    select: {
      nomeExibicao: true,
      turmas: {
        orderBy: [{ status: "asc" }, { dataInicio: "desc" }],
        include: {
          curso: { select: { nome: true } },
          _count: { select: { matriculas: true } },
        },
      },
    },
  });

  const turmas = instrutor?.turmas ?? [];

  return (
    <CapacitacaoShell session={session}>
      <PageHead
        eyebrow="Capacitação · Instrutor"
        title="Minhas turmas"
        desc={
          instrutor
            ? `Turmas que você ministra, ${instrutor.nomeExibicao}. Abra uma para registrar a presença da aula.`
            : "Seu login ainda não está vinculado a um cadastro de instrutor — fale com a coordenação."
        }
      />

      {turmas.length === 0 ? (
        <EmptyState
          titulo={instrutor ? "Você ainda não tem turmas atribuídas." : "Sem vínculo de instrutor."}
          descricao={
            instrutor
              ? "Quando a coordenação atribuir uma turma a você, ela aparece aqui."
              : "Fale com a coordenação para vincular seu login a um cadastro de instrutor."
          }
        />
      ) : (
        <div className="card">
          <div className={styles.list}>
            {turmas.map((t) => {
              const vt = STATUS_TURMA_VISUAL[t.status];
              return (
                <Link
                  key={t.id}
                  href={`/capacitacao/turmas/${t.id}` as Route}
                  className={styles.row}
                  style={{ textDecoration: "none" }}
                >
                  <div className={styles.rowMain}>
                    <div className={styles.rowTitle}>{t.curso.nome}</div>
                    <div className={styles.rowMeta}>
                      <span className="mono">{t.codigo}</span>
                      <span>
                        · {fmt.format(t.dataInicio)}–{fmt.format(t.dataFim)}
                      </span>
                      <span>
                        · {t._count.matriculas} matrícula{t._count.matriculas === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                  <div className={styles.rowRight}>
                    <Badge variant={vt.variant}>{vt.label}</Badge>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </CapacitacaoShell>
  );
}
