import { redirect } from "next/navigation";
import type { Route } from "next";
import clsx from "clsx";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { db } from "@/lib/db";
import { CapacitacaoShell } from "@/components/capacitacao/capacitacao-shell";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { EmptyState } from "@/components/ui/empty-state";
import { podeGerenciarInstrutor } from "@/lib/capacitacao/rbac";
import { PageHead } from "../_components/ui";
import {
  criarInstrutorAction,
  editarInstrutorAction,
  toggleInstrutorAtivoAction,
  vincularLoginInstrutorAction,
} from "../actions";
import styles from "../capacitacao.module.css";

const VINC_ERROS: Record<string, string> = {
  user_nao_encontrado:
    "Nenhum usuário com esse e-mail. Crie a conta antes em Configurações → Usuários.",
  user_sem_papel: "Esse usuário não tem o papel de profissional na Capacitação.",
  user_ja_vinculado: "Esse usuário já está vinculado a outro instrutor.",
};

export default async function InstrutoresPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; vinculo?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/capacitacao/login" as Route);
  if (!canAccessUnidade(session, "capacitacao")) redirect("/" as Route);
  if (!podeGerenciarInstrutor(session)) redirect("/capacitacao" as Route);
  const { erro, vinculo } = await searchParams;

  const instrutores = await db.instrutor.findMany({
    orderBy: [{ ativo: "desc" }, { nomeExibicao: "asc" }],
    include: { _count: { select: { turmas: true } }, user: { select: { email: true } } },
  });

  return (
    <CapacitacaoShell session={session}>
      <PageHead
        eyebrow="Capacitação · Equipe"
        eyebrowHref="/capacitacao"
        title="Instrutores"
        desc="Quem ministra as turmas. Vincule um login (papel profissional·capacitação) pra o instrutor marcar presença das próprias turmas."
      />

      {erro && VINC_ERROS[erro] ? (
        <div role="alert" className={clsx(styles.alert, styles.alertError)}>
          {VINC_ERROS[erro]}
        </div>
      ) : null}
      {vinculo === "ok" ? (
        <div className={styles.alert}>Login vinculado ao instrutor.</div>
      ) : vinculo === "editado" ? (
        <div className={styles.alert}>Instrutor atualizado.</div>
      ) : null}

      <div className={styles.grid2}>
        <div className="card" style={{ alignSelf: "start" }}>
          <header>
            <span className="tick" />
            <h3>NOVO INSTRUTOR</h3>
          </header>
          <div className="body">
            <form action={criarInstrutorAction}>
              <div className="field-group">
                <label className="label" htmlFor="novo-nome">
                  Nome de exibição
                </label>
                <input
                  id="novo-nome"
                  name="nomeExibicao"
                  required
                  placeholder="Ex: Prof. Carlos Andrade"
                  className="input"
                />
              </div>
              <div className="field-group">
                <label className="label" htmlFor="novo-bio">
                  Bio / especialidade (opcional)
                </label>
                <textarea
                  id="novo-bio"
                  name="bio"
                  placeholder="Áreas de atuação, formação…"
                  className="textarea"
                />
              </div>
              <SubmitButton pendingLabel="Adicionando instrutor…">Adicionar instrutor</SubmitButton>
            </form>
          </div>
        </div>

        {instrutores.length === 0 ? (
          <EmptyState
            titulo="Nenhum instrutor cadastrado ainda"
            descricao="Adicione o primeiro instrutor no formulário ao lado."
          />
        ) : (
          <div className="card">
            <header>
              <span className="tick" />
              <h3>EQUIPE</h3>
              <span className="act text-3" style={{ pointerEvents: "none" }}>
                {instrutores.length}
              </span>
            </header>
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
                          <span className="mono">{i.user.email}</span>
                        </>
                      ) : null}
                    </div>
                    {!i.user ? (
                      <form
                        action={vincularLoginInstrutorAction}
                        style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}
                      >
                        <input type="hidden" name="instrutorId" value={i.id} />
                        <input
                          name="email"
                          type="email"
                          required
                          placeholder="e-mail do login (profissional)"
                          className="input"
                          style={{ maxWidth: 240 }}
                        />
                        <SubmitButton variant="ghost" size="sm" pendingLabel="Vinculando login…">
                          Vincular login
                        </SubmitButton>
                      </form>
                    ) : null}
                    <details style={{ marginTop: 8 }}>
                      <summary
                        className="micro"
                        style={{ cursor: "pointer", color: "var(--text-3)" }}
                      >
                        Editar
                      </summary>
                      <form
                        action={editarInstrutorAction}
                        style={{ display: "grid", gap: 8, marginTop: 8, maxWidth: 320 }}
                      >
                        <input type="hidden" name="instrutorId" value={i.id} />
                        <input
                          name="nomeExibicao"
                          defaultValue={i.nomeExibicao}
                          required
                          className="input"
                        />
                        <textarea
                          name="bio"
                          defaultValue={i.bio ?? ""}
                          placeholder="Bio / especialidade"
                          className="textarea"
                        />
                        <SubmitButton size="sm" pendingLabel="Salvando…">
                          Salvar
                        </SubmitButton>
                      </form>
                    </details>
                  </div>
                  <div className={styles.rowRight}>
                    {!i.ativo ? <Badge variant="default">Inativo</Badge> : null}
                    <span className="mono" style={{ fontSize: 12, color: "var(--text-3)" }}>
                      {i._count.turmas} turma{i._count.turmas === 1 ? "" : "s"}
                    </span>
                    <form action={toggleInstrutorAtivoAction}>
                      <input type="hidden" name="instrutorId" value={i.id} />
                      <SubmitButton
                        variant={i.ativo ? "danger" : "ghost"}
                        size="sm"
                        pendingLabel="Alterando status…"
                      >
                        {i.ativo ? "Desativar" : "Reativar"}
                      </SubmitButton>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </CapacitacaoShell>
  );
}
