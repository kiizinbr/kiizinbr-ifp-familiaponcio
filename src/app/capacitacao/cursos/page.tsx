import Link from "next/link";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { db } from "@/lib/db";
import { CapacitacaoShell } from "@/components/capacitacao/capacitacao-shell";
import { podeGerenciarCurso } from "@/lib/capacitacao/rbac";
import { PageHead } from "../_components/ui";
import { criarCursoAction } from "../actions";
import styles from "../capacitacao.module.css";

export default async function CatalogoPage() {
  const session = await auth();
  if (!session) redirect("/login" as Route);
  if (!canAccessUnidade(session, "capacitacao")) redirect("/" as Route);

  const podeCriar = podeGerenciarCurso(session);

  const cursos = await db.curso.findMany({
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
    include: { _count: { select: { turmas: true } } },
  });
  const ativos = cursos.filter((c) => c.ativo).length;

  return (
    <CapacitacaoShell session={session}>
      <div className={styles.root}>
        <PageHead
          eyebrow="Capacitação · Catálogo"
          title="Cursos"
          desc="O catálogo de cursos da capacitação. Cada curso gera turmas datadas com vagas, instrutor e matrículas."
        />

        <div className={podeCriar ? styles.grid2 : undefined}>
          {podeCriar ? (
            <div className={`${styles.card}`} style={{ alignSelf: "start" }}>
              <div className={styles.cardHeader}>
                <span className={styles.tick} />
                <h2 className={styles.cardTitle}>NOVO CURSO</h2>
                <span className={styles.headNote}>
                  {ativos} ativo{ativos === 1 ? "" : "s"} · {cursos.length} no total
                </span>
              </div>
              <div className={styles.body}>
                <form action={criarCursoAction} className={styles.form}>
                  <label className={styles.label}>
                    <span className={styles.labelText}>Nome do curso</span>
                    <input
                      name="nome"
                      required
                      placeholder="Ex: Informática Básica"
                      className={styles.input}
                    />
                  </label>
                  <label className={styles.label}>
                    <span className={styles.labelText}>Área</span>
                    <input
                      name="area"
                      required
                      placeholder="Ex: Tecnologia"
                      className={styles.input}
                    />
                  </label>
                  <label className={styles.label}>
                    <span className={styles.labelText}>Descrição</span>
                    <textarea
                      name="descricao"
                      placeholder="Breve descrição do conteúdo e objetivos."
                      className={styles.textarea}
                    />
                  </label>
                  <div className={styles.fieldGrid}>
                    <label className={styles.label}>
                      <span className={styles.labelText}>Modalidade</span>
                      <select name="modalidade" className={styles.select} defaultValue="presencial">
                        <option value="presencial">Presencial</option>
                        <option value="online">Online</option>
                        <option value="hibrido">Híbrido</option>
                      </select>
                    </label>
                    <label className={styles.label}>
                      <span className={styles.labelText}>Carga horária (h)</span>
                      <input
                        name="cargaHorariaTotal"
                        type="number"
                        min={1}
                        defaultValue={20}
                        className={styles.input}
                      />
                    </label>
                  </div>
                  <label className={styles.label}>
                    <span className={styles.labelText}>Capacidade padrão por turma</span>
                    <input
                      name="capacidadePadrao"
                      type="number"
                      min={1}
                      defaultValue={20}
                      className={styles.input}
                    />
                  </label>
                  <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
                    Adicionar curso
                  </button>
                </form>
              </div>
            </div>
          ) : null}

          {cursos.length === 0 ? (
            <div className={styles.card}>
              <div className={styles.empty}>
                Nenhum curso cadastrado ainda.
                {podeCriar ? " Use o formulário ao lado para criar o primeiro." : ""}
              </div>
            </div>
          ) : (
            <div className={styles.cards}>
              {cursos.map((c) => (
                <Link
                  key={c.id}
                  href={`/capacitacao/cursos/${c.id}` as Route}
                  className={styles.course}
                  style={c.ativo ? undefined : { opacity: 0.55 }}
                >
                  <span className={styles.courseArea}>{c.area}</span>
                  <span className={styles.courseName}>{c.nome}</span>
                  {c.descricao ? <span className={styles.courseDesc}>{c.descricao}</span> : null}
                  <span className={styles.courseFoot}>
                    <span>
                      <b>{c.cargaHorariaTotal}h</b> · {c.modalidade}
                    </span>
                    <span>
                      <b>{c._count.turmas}</b> turma{c._count.turmas === 1 ? "" : "s"}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </CapacitacaoShell>
  );
}
