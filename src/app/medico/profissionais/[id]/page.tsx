import { redirect, notFound } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { db } from "@/lib/db";
import { MedicoShell, MedicoHeader } from "@/components/medico/medico-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { podeGerenciarProfissional } from "@/lib/medico/rbac";
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

  const podeEditar = podeGerenciarProfissional(session) || session.user.id === prof.userId;
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
            <form action={toggleProfissionalAction}>
              <input type="hidden" name="id" value={prof.id} />
              <SubmitButton
                variant="secondary"
                pendingLabel="Aplicando…"
                style={{
                  borderColor: prof.ativo ? "var(--danger)" : "var(--accent)",
                  color: prof.ativo ? "var(--danger)" : "var(--accent)",
                }}
              >
                {prof.ativo ? "Desativar" : "Reativar"}
              </SubmitButton>
            </form>
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
              <div className="grid grid-cols-2 gap-3">
                <label className="field-group">
                  <span className="label">Conselho</span>
                  <input name="conselho" defaultValue={prof.conselho} required className="input" />
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
