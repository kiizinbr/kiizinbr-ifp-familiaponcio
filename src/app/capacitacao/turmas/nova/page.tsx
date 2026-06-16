import Link from "next/link";
import { redirect } from "next/navigation";
import type { Route } from "next";
import clsx from "clsx";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { db } from "@/lib/db";
import { CapacitacaoShell } from "@/components/capacitacao/capacitacao-shell";
import { SubmitButton } from "@/components/ui/submit-button";
import { EmptyState } from "@/components/ui/empty-state";
import { podeCriarTurma } from "@/lib/capacitacao/rbac";
import { PageHead } from "../../_components/ui";
import { criarTurmaAction } from "../../actions";
import styles from "../../capacitacao.module.css";

const ERROS: Record<string, string> = {
  codigo_duplicado: "Já existe uma turma com esse código. Use um código diferente.",
};

export default async function NovaTurmaPage({
  searchParams,
}: {
  searchParams: Promise<{
    erro?: string;
    cursoId?: string;
    codigo?: string;
    dataInicio?: string;
    dataFim?: string;
    local?: string;
    capacidade?: string;
    instrutorId?: string;
  }>;
}) {
  const session = await auth();
  if (!session) redirect("/capacitacao/login" as Route);
  if (!canAccessUnidade(session, "capacitacao")) redirect("/" as Route);
  if (!podeCriarTurma(session)) redirect("/capacitacao/turmas" as Route);

  const { erro, cursoId, codigo, dataInicio, dataFim, local, capacidade, instrutorId } =
    await searchParams;

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
      <PageHead
        eyebrow="Capacitação · Turmas"
        eyebrowHref="/capacitacao"
        title="Nova turma"
        desc="Uma turma é uma instância datada de um curso, com vagas próprias. As matrículas entram depois, pela tela da turma."
        action={
          <Link href={"/capacitacao/turmas" as Route} className="btn btn-secondary">
            Cancelar
          </Link>
        }
      />

      {erro && ERROS[erro] ? (
        <div role="alert" className={clsx(styles.alert, styles.alertError)}>
          {ERROS[erro]}
        </div>
      ) : null}

      {cursos.length === 0 ? (
        <EmptyState
          titulo="Nenhum curso ativo"
          descricao="É preciso ter ao menos um curso ativo no catálogo antes de abrir uma turma."
          cta={
            <Link href={"/capacitacao/cursos" as Route} className="btn btn-secondary">
              Ir ao catálogo
            </Link>
          }
        />
      ) : (
        <div className="card">
          <header>
            <span className="tick" />
            <h3>DADOS DA TURMA</h3>
          </header>
          <div className="body">
            <form action={criarTurmaAction}>
              <label className="field-group">
                <span className="label">Curso</span>
                <select name="cursoId" required defaultValue={cursoId ?? ""} className="select">
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
                <label className="field-group">
                  <span className="label">Código da turma</span>
                  <input
                    name="codigo"
                    required
                    defaultValue={codigo ?? ""}
                    placeholder="Ex: INFO-2026-01"
                    className="input"
                  />
                </label>
                <label className="field-group">
                  <span className="label">Capacidade</span>
                  <input
                    name="capacidade"
                    type="number"
                    min={1}
                    defaultValue={capacidade ?? ""}
                    placeholder="20"
                    className="input"
                  />
                </label>
              </div>

              <div className={styles.fieldGrid}>
                <label className="field-group">
                  <span className="label">Início</span>
                  <input
                    name="dataInicio"
                    type="date"
                    required
                    defaultValue={dataInicio ?? ""}
                    className="input"
                  />
                </label>
                <label className="field-group">
                  <span className="label">Término</span>
                  <input
                    name="dataFim"
                    type="date"
                    required
                    defaultValue={dataFim ?? ""}
                    className="input"
                  />
                </label>
              </div>

              <label className="field-group">
                <span className="label">Local</span>
                <input
                  name="local"
                  defaultValue={local ?? ""}
                  placeholder="Ex: Sala 2 — Sede"
                  className="input"
                />
              </label>

              <label className="field-group">
                <span className="label">Instrutor (opcional)</span>
                <select name="instrutorId" defaultValue={instrutorId ?? ""} className="select">
                  <option value="">— a definir —</option>
                  {instrutores.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.nomeExibicao}
                    </option>
                  ))}
                </select>
              </label>

              <SubmitButton pendingLabel="Criando turma…">Criar turma</SubmitButton>
            </form>
          </div>
        </div>
      )}
    </CapacitacaoShell>
  );
}
