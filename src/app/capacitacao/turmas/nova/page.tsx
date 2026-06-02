import Link from "next/link";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { db } from "@/lib/db";
import { CapacitacaoShell } from "@/components/capacitacao/capacitacao-shell";
import { podeCriarTurma } from "@/lib/capacitacao/rbac";
import { PageHead } from "../../_components/ui";
import { criarTurmaAction } from "../../actions";
import styles from "../../capacitacao.module.css";

export default async function NovaTurmaPage() {
  const session = await auth();
  if (!session) redirect("/login" as Route);
  if (!canAccessUnidade(session, "capacitacao")) redirect("/" as Route);
  if (!podeCriarTurma(session)) redirect("/capacitacao/turmas" as Route);

  const [cursos, instrutores] = await Promise.all([
    db.curso.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, capacidadePadrao: true },
    }),
    db.instrutor.findMany({
      where: { ativo: true },
      orderBy: { nomeExibicao: "asc" },
      select: { id: true, nomeExibicao: true },
    }),
  ]);

  return (
    <CapacitacaoShell session={session}>
      <div className={styles.root}>
        <PageHead
          eyebrow="Capacitação · Turmas"
          title="Nova turma"
          desc="Uma turma é uma instância datada de um curso, com vagas próprias. As matrículas entram depois, pela tela da turma."
          action={
            <Link href={"/capacitacao/turmas" as Route} className={`${styles.btn} ${styles.btnGhost}`}>
              Cancelar
            </Link>
          }
        />

        {cursos.length === 0 ? (
          <div className={styles.card}>
            <div className={styles.empty}>
              É preciso ter ao menos um curso ativo no catálogo antes de abrir uma turma.{" "}
              <Link href={"/capacitacao/cursos" as Route} className={styles.link}>
                Ir ao catálogo
              </Link>
            </div>
          </div>
        ) : (
          <div className={styles.card} style={{ maxWidth: 620 }}>
            <div className={styles.cardHeader}>
              <span className={styles.tick} />
              <h2 className={styles.cardTitle}>DADOS DA TURMA</h2>
            </div>
            <div className={styles.body}>
              <form action={criarTurmaAction} className={styles.form}>
                <label className={styles.label}>
                  <span className={styles.labelText}>Curso</span>
                  <select name="cursoId" required className={styles.select} defaultValue="">
                    <option value="" disabled>
                      Selecione um curso…
                    </option>
                    {cursos.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </label>

                <div className={styles.fieldGrid}>
                  <label className={styles.label}>
                    <span className={styles.labelText}>Código da turma</span>
                    <input
                      name="codigo"
                      required
                      placeholder="Ex: INFO-2026-01"
                      className={styles.input}
                    />
                  </label>
                  <label className={styles.label}>
                    <span className={styles.labelText}>Capacidade</span>
                    <input
                      name="capacidade"
                      type="number"
                      min={1}
                      placeholder="20"
                      className={styles.input}
                    />
                  </label>
                </div>

                <div className={styles.fieldGrid}>
                  <label className={styles.label}>
                    <span className={styles.labelText}>Início</span>
                    <input name="dataInicio" type="date" required className={styles.input} />
                  </label>
                  <label className={styles.label}>
                    <span className={styles.labelText}>Término</span>
                    <input name="dataFim" type="date" required className={styles.input} />
                  </label>
                </div>

                <label className={styles.label}>
                  <span className={styles.labelText}>Local</span>
                  <input
                    name="local"
                    placeholder="Ex: Sala 2 — Sede"
                    className={styles.input}
                  />
                </label>

                <label className={styles.label}>
                  <span className={styles.labelText}>Instrutor (opcional)</span>
                  <select name="instrutorId" className={styles.select} defaultValue="">
                    <option value="">— a definir —</option>
                    {instrutores.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.nomeExibicao}
                      </option>
                    ))}
                  </select>
                </label>

                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
                  Criar turma
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </CapacitacaoShell>
  );
}
