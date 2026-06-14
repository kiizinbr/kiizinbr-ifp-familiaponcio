import { redirect, notFound } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { db } from "@/lib/db";
import { MedicoShell, MedicoHeader } from "@/components/medico/medico-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { camposEditaveisProfissional, podeGerenciarProfissional } from "@/lib/medico/rbac";
import { formatarDiasSemana } from "@/lib/medico/ui";
import { atualizarProfissionalAction, toggleProfissionalAction } from "../actions";

export default async function ProfissionalDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session) redirect("/medico/login" as Route);
  if (!canAccessUnidade(session, "medico")) redirect("/" as Route);

  const prof = await db.profissional.findUnique({
    where: { id },
    include: {
      especialidades: { include: { especialidade: true } },
      templates: { where: { ativo: true }, include: { especialidade: true } },
    },
  });
  if (!prof) notFound();

  const ehProprio = session.user.id === prof.userId;
  const campos = camposEditaveisProfissional(session, ehProprio);
  const podeEditar = campos.length > 0;
  // M5 — espelha a allowlist da action: o dono não-gestor não edita o próprio
  // CRM/especialidades (defesa em profundidade; o gate real é a action).
  const podeEditarCrm = campos.includes("conselho");
  const podeEditarEspecialidades = campos.includes("especialidades");
  const especialidades = await db.especialidade.findMany({
    where: { ativa: true },
    orderBy: { nome: "asc" },
  });
  const selecionadas = new Set(prof.especialidades.map((pe) => pe.especialidadeId));

  return (
    <MedicoShell session={session}>
      <MedicoHeader
        eyebrow="Profissional"
        titulo={prof.nomeExibicao}
        descricao={`${prof.conselho} ${prof.nroConselho}`}
        acao={
          podeGerenciarProfissional(session) ? (
            prof.ativo ? (
              // Desativar é destrutivo (some das novas reservas): confirma via
              // ConfirmDialog do kit. A action (toggleProfissionalAction) e o
              // campo `id` são idênticos — o diálogo só ENVOLVE.
              <ConfirmDialog
                action={toggleProfissionalAction}
                danger
                triggerVariant="secondary"
                triggerLabel="Desativar"
                title="Desativar profissional?"
                message="Some das novas reservas na agenda."
                confirmLabel="Desativar"
                hiddenFields={{ id: prof.id }}
              />
            ) : (
              <form action={toggleProfissionalAction}>
                <input type="hidden" name="id" value={prof.id} />
                <SubmitButton
                  variant="secondary"
                  pendingLabel="Aplicando…"
                  style={{
                    borderColor: "var(--accent)",
                    color: "var(--accent)",
                  }}
                >
                  Reativar
                </SubmitButton>
              </form>
            )
          ) : undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {podeEditar ? (
          <Card>
            <h2 className="t-h3 mb-4">Dados do profissional</h2>
            <form action={atualizarProfissionalAction} className="space-y-4">
              <input type="hidden" name="id" value={prof.id} />
              <label className="field-group">
                <span className="label">Nome de exibição</span>
                <input
                  name="nomeExibicao"
                  defaultValue={prof.nomeExibicao}
                  required
                  className="input"
                />
              </label>
              {podeEditarCrm ? (
                <div className="grid grid-cols-2 gap-3">
                  <label className="field-group">
                    <span className="label">Conselho</span>
                    <input
                      name="conselho"
                      defaultValue={prof.conselho}
                      required
                      className="input"
                    />
                  </label>
                  <label className="field-group">
                    <span className="label">Nº conselho</span>
                    <input
                      name="nroConselho"
                      defaultValue={prof.nroConselho}
                      required
                      className="input"
                    />
                  </label>
                </div>
              ) : (
                // Dono não-gestor: CRM é só leitura (a action também o preserva).
                <div className="grid grid-cols-2 gap-3">
                  <div className="field-group">
                    <span className="label">Conselho</span>
                    <p className="t-body" style={{ color: "var(--text-3)" }}>
                      {prof.conselho} {prof.nroConselho}
                    </p>
                    <span className="micro" style={{ color: "var(--text-3)" }}>
                      Só a gestão altera o registro do conselho.
                    </span>
                  </div>
                </div>
              )}
              {podeEditarEspecialidades ? (
                <fieldset>
                  <legend className="label">Especialidades</legend>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {especialidades.map((e) => (
                      <label
                        key={e.id}
                        className="flex cursor-pointer items-center gap-2 px-2.5 py-2 text-sm transition hover:[border-color:var(--line-strong)]"
                        style={{
                          border: "1px solid var(--line)",
                          borderRadius: "var(--r-sm)",
                          background: "var(--surface)",
                          color: "var(--text)",
                        }}
                      >
                        <input
                          type="checkbox"
                          name="especialidadeIds"
                          value={e.id}
                          defaultChecked={selecionadas.has(e.id)}
                          style={{ accentColor: "var(--accent)" }}
                        />
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: e.corDestaque }}
                        />
                        <span className="truncate">{e.nome}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : (
                // Dono não-gestor: especialidades em só leitura (a action as preserva).
                <div className="field-group">
                  <span className="label">Especialidades</span>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {prof.especialidades.map((pe) => (
                      <span
                        key={pe.especialidadeId}
                        className="rounded-[var(--r-sm)] px-2 py-0.5 text-[11px] font-medium"
                        style={{
                          background: pe.especialidade.corDestaque + "1f",
                          color: pe.especialidade.corDestaque,
                        }}
                      >
                        {pe.especialidade.nome}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <label className="field-group">
                <span className="label">Bio</span>
                <textarea name="bio" defaultValue={prof.bio ?? ""} rows={3} className="textarea" />
              </label>
              <SubmitButton pendingLabel="Salvando…">Salvar alterações</SubmitButton>
            </form>
          </Card>
        ) : (
          <Card>
            <h2 className="t-h3 mb-3">Sobre</h2>
            <p className="t-body" style={{ color: "var(--text)" }}>
              {prof.bio ?? "Sem bio cadastrada."}
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {prof.especialidades.map((pe) => (
                <span
                  key={pe.especialidadeId}
                  className="rounded-[var(--r-sm)] px-2 py-0.5 text-[11px] font-medium"
                  style={{
                    background: pe.especialidade.corDestaque + "1f",
                    color: pe.especialidade.corDestaque,
                  }}
                >
                  {pe.especialidade.nome}
                </span>
              ))}
            </div>
          </Card>
        )}

        {/* Sidebar: status + templates ativos */}
        <div className="space-y-6">
          <Card accent="medico">
            <div className="flex items-center justify-between">
              <span className="micro">Status</span>
              {prof.ativo ? (
                <Badge variant="success">Ativo</Badge>
              ) : (
                <Badge variant="default">Inativo</Badge>
              )}
            </div>
          </Card>

          <Card>
            <h3 className="t-h3 mb-3">Templates de agenda</h3>
            {prof.templates.length === 0 ? (
              <p className="text-3 text-sm">
                Nenhum template ativo. O próprio profissional configura em{" "}
                <strong>Minha agenda</strong>.
              </p>
            ) : (
              <ul className="space-y-2">
                {prof.templates.map((t) => (
                  <li
                    key={t.id}
                    className="rounded-[var(--r-sm)] border px-3 py-2 text-sm"
                    style={{
                      borderColor: "var(--line)",
                      borderLeft: `3px solid ${t.especialidade.corDestaque}`,
                    }}
                  >
                    <p className="font-medium" style={{ color: "var(--text)" }}>
                      {t.especialidade.nome}
                    </p>
                    <p className="text-3 mono text-xs">
                      {formatarDiasSemana(t.diasSemana)} · {t.faixaInicio}–{t.faixaFim} ·{" "}
                      {t.duracaoSlotMin}min
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </MedicoShell>
  );
}
