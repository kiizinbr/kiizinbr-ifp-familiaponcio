import { redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { db } from "@/lib/db";
import { CapacitacaoShell } from "@/components/capacitacao/capacitacao-shell";
import { podeGerenciarInstrutor } from "@/lib/capacitacao/rbac";
import { PageHead, KitBadge } from "../_components/ui";
import { criarInstrutorAction } from "../actions";
import styles from "../capacitacao.module.css";

export default async function InstrutoresPage() {
  const session = await auth();
  if (!session) redirect("/capacitacao/login" as Route);
  if (!canAccessUnidade(session, "capacitacao")) redirect("/" as Route);
  if (!podeGerenciarInstrutor(session)) redirect("/capacitacao" as Route);

  const instrutores = await db.instrutor.findMany({
    orderBy: [{ ativo: "desc" }, { nomeExibicao: "asc" }],
    include: { _count: { select: { turmas: true } }, user: { select: { email: true } } },
  });

  return (
    <CapacitacaoShell session={session}>
      <div className={styles.root}>
        <PageHead
          eyebrow="Capacitação · Equipe"
          title="Instrutores"
          desc="Quem ministra as turmas. O vínculo com login do sistema vem na próxima fase (F1.A.2) — por ora, cadastro pelo nome de exibição."
        />

        <div className={styles.grid2}>
          <div className={styles.card} style={{ alignSelf: "start" }}>
            <div className={styles.cardHeader}>
              <span className={styles.tick} />
              <h2 className={styles.cardTitle}>NOVO INSTRUTOR</h2>
            </div>
            <div className={styles.body}>
              <form action={criarInstrutorAction} className={styles.form}>
                <label className={styles.label}>
                  <span className={styles.labelText}>Nome de exibição</span>
                  <input
                    name="nomeExibicao"
                    required
                    placeholder="Ex: Prof. Carlos Andrade"
                    className={styles.input}
                  />
                </label>
                <label className={styles.label}>
                  <span className={styles.labelText}>Bio / especialidade (opcional)</span>
                  <textarea
                    name="bio"
                    placeholder="Áreas de atuação, formação…"
                    className={styles.textarea}
                  />
                </label>
                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
                  Adicionar instrutor
                </button>
              </form>
            </div>
          </div>

          {instrutores.length === 0 ? (
            <div className={styles.card}>
              <div className={styles.empty}>Nenhum instrutor cadastrado ainda.</div>
            </div>
          ) : (
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.tick} />
                <h2 className={styles.cardTitle}>EQUIPE</h2>
                <span className={styles.headNote}>{instrutores.length}</span>
              </div>
              <div className={styles.list}>
                {instrutores.map((i) => (
                  <div
                    key={i.id}
                    className={styles.row}
                    style={i.ativo ? undefined : { opacity: 0.55 }}
                  >
                    <div className={styles.rowMain}>
                      <div className={styles.rowTitle}>{i.nomeExibicao}</div>
                      <div className={styles.rowMeta}>
                        {i.bio ? <span>{i.bio}</span> : <span>—</span>}
                        {i.user ? (
                          <>
                            <span>·</span>
                            <span className={styles.mono}>{i.user.email}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <div className={styles.rowRight}>
                      {!i.ativo ? <KitBadge variant="default">Inativo</KitBadge> : null}
                      <span
                        className={styles.mono}
                        style={{ fontSize: 12, color: "var(--text-3)" }}
                      >
                        {i._count.turmas} turma{i._count.turmas === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </CapacitacaoShell>
  );
}
