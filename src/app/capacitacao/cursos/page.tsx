import Link from "next/link";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { db } from "@/lib/db";
import { CapacitacaoShell } from "@/components/capacitacao/capacitacao-shell";
import { SubmitButton } from "@/components/ui/submit-button";
import { EmptyState } from "@/components/ui/empty-state";
import { podeGerenciarCurso } from "@/lib/capacitacao/rbac";
import { PageHead } from "../_components/ui";
import { criarCursoAction } from "../actions";
import styles from "../capacitacao.module.css";

export default async function CatalogoPage() {
  const session = await auth();
  if (!session) redirect("/capacitacao/login" as Route);
  if (!canAccessUnidade(session, "capacitacao")) redirect("/" as Route);

  const podeCriar = podeGerenciarCurso(session);

  const cursos = await db.curso.findMany({
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
    include: { _count: { select: { turmas: true } } },
  });
  const ativos = cursos.filter((c) => c.ativo).length;

  return (
    <CapacitacaoShell session={session}>
      <PageHead
        eyebrow="Capacitação · Catálogo"
        title="Cursos"
        desc="O catálogo de cursos da capacitação. Cada curso gera turmas datadas com vagas, instrutor e matrículas."
      />

      <div className={podeCriar ? styles.grid2 : undefined}>
        {podeCriar ? (
          <div className="card" style={{ alignSelf: "start" }}>
            <header>
              <span className="tick" />
              <h3>NOVO CURSO</h3>
              <span className="act text-3">
                {ativos} ativo{ativos === 1 ? "" : "s"} · {cursos.length} no total
              </span>
            </header>
            <div className="body">
              <form action={criarCursoAction}>
                <label className="field-group">
                  <span className="label">Nome do curso</span>
                  <input
                    name="nome"
                    required
                    placeholder="Ex: Informática Básica"
                    className="input"
                  />
                </label>
                <label className="field-group">
                  <span className="label">Área</span>
                  <input name="area" required placeholder="Ex: Tecnologia" className="input" />
                </label>
                <label className="field-group">
                  <span className="label">Descrição</span>
                  <textarea
                    name="descricao"
                    placeholder="Breve descrição do conteúdo e objetivos."
                    className="textarea"
                  />
                </label>
                <div className={styles.fieldGrid}>
                  <label className="field-group">
                    <span className="label">Modalidade</span>
                    <select name="modalidade" className="select" defaultValue="presencial">
                      <option value="presencial">Presencial</option>
                      <option value="online">Online</option>
                      <option value="hibrido">Híbrido</option>
                    </select>
                  </label>
                  <label className="field-group">
                    <span className="label">Carga horária (h)</span>
                    <input
                      name="cargaHorariaTotal"
                      type="number"
                      min={1}
                      defaultValue={20}
                      className="input"
                    />
                  </label>
                </div>
                <label className="field-group">
                  <span className="label">Capacidade padrão por turma</span>
                  <input
                    name="capacidadePadrao"
                    type="number"
                    min={1}
                    defaultValue={20}
                    className="input"
                  />
                </label>
                <SubmitButton className="btn-block" pendingLabel="Adicionando curso…">
                  Adicionar curso
                </SubmitButton>
              </form>
            </div>
          </div>
        ) : null}

        {cursos.length === 0 ? (
          <EmptyState
            titulo="Nenhum curso cadastrado ainda"
            descricao={
              podeCriar
                ? "Use o formulário ao lado para criar o primeiro."
                : "Os cursos aparecem aqui assim que forem cadastrados."
            }
          />
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
    </CapacitacaoShell>
  );
}
