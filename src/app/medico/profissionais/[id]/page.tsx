import { redirect, notFound } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { db } from "@/lib/db";
import { MedicoShell, MedicoHeader } from "@/components/medico/medico-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { podeGerenciarProfissional } from "@/lib/medico/rbac";
import { formatarDiasSemana } from "@/lib/medico/ui";
import { atualizarProfissionalAction, toggleProfissionalAction } from "../actions";

const fieldCls =
  "mt-1 w-full rounded-[var(--ifp-radius-sm)] border px-3 py-2 text-sm focus:border-[rgb(var(--ifp-teal-700))] focus:outline-none";
const labelCls = "text-xs font-medium";

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
              <button
                type="submit"
                className="rounded-[var(--ifp-radius-md)] border px-4 py-2 text-sm font-semibold transition hover:bg-[rgb(var(--ifp-surface-50))]"
                style={{
                  borderColor: prof.ativo ? "rgb(var(--ifp-danger))" : "rgb(var(--ifp-teal-700))",
                  color: prof.ativo ? "rgb(var(--ifp-danger))" : "rgb(var(--ifp-teal-700))",
                }}
              >
                {prof.ativo ? "Desativar" : "Reativar"}
              </button>
            </form>
          ) : undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {podeEditar ? (
          <Card>
            <h2
              className="mb-4 text-sm font-bold tracking-wide"
              style={{ color: "rgb(var(--ifp-ink))" }}
            >
              Dados do profissional
            </h2>
            <form action={atualizarProfissionalAction} className="space-y-4">
              <input type="hidden" name="id" value={prof.id} />
              <label className="block">
                <span className={labelCls} style={{ color: "rgb(var(--ifp-muted))" }}>
                  Nome de exibição
                </span>
                <input
                  name="nomeExibicao"
                  defaultValue={prof.nomeExibicao}
                  required
                  className={fieldCls}
                  style={{ borderColor: "rgb(var(--ifp-surface-200))" }}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className={labelCls} style={{ color: "rgb(var(--ifp-muted))" }}>
                    Conselho
                  </span>
                  <input
                    name="conselho"
                    defaultValue={prof.conselho}
                    required
                    className={fieldCls}
                    style={{ borderColor: "rgb(var(--ifp-surface-200))" }}
                  />
                </label>
                <label className="block">
                  <span className={labelCls} style={{ color: "rgb(var(--ifp-muted))" }}>
                    Nº conselho
                  </span>
                  <input
                    name="nroConselho"
                    defaultValue={prof.nroConselho}
                    required
                    className={fieldCls}
                    style={{ borderColor: "rgb(var(--ifp-surface-200))" }}
                  />
                </label>
              </div>
              <fieldset>
                <legend className={labelCls} style={{ color: "rgb(var(--ifp-muted))" }}>
                  Especialidades
                </legend>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {especialidades.map((e) => (
                    <label
                      key={e.id}
                      className="flex cursor-pointer items-center gap-2 rounded-[var(--ifp-radius-sm)] border px-2.5 py-2 text-sm transition hover:bg-[rgb(var(--ifp-surface-50))]"
                      style={{ borderColor: "rgb(var(--ifp-surface-200))" }}
                    >
                      <input
                        type="checkbox"
                        name="especialidadeIds"
                        value={e.id}
                        defaultChecked={selecionadas.has(e.id)}
                        className="accent-[rgb(var(--ifp-teal-700))]"
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
              <label className="block">
                <span className={labelCls} style={{ color: "rgb(var(--ifp-muted))" }}>
                  Bio
                </span>
                <textarea
                  name="bio"
                  defaultValue={prof.bio ?? ""}
                  rows={3}
                  className={fieldCls}
                  style={{ borderColor: "rgb(var(--ifp-surface-200))" }}
                />
              </label>
              <button
                type="submit"
                className="rounded-[var(--ifp-radius-md)] px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
                style={{ backgroundColor: "rgb(var(--ifp-teal-700))" }}
              >
                Salvar alterações
              </button>
            </form>
          </Card>
        ) : (
          <Card>
            <h2
              className="mb-3 text-sm font-bold tracking-wide"
              style={{ color: "rgb(var(--ifp-ink))" }}
            >
              Sobre
            </h2>
            <p style={{ color: "rgb(var(--ifp-ink))" }}>{prof.bio ?? "Sem bio cadastrada."}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {prof.especialidades.map((pe) => (
                <span
                  key={pe.especialidadeId}
                  className="rounded px-2 py-0.5 text-[11px] font-medium"
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
              <span className="text-sm font-semibold" style={{ color: "rgb(var(--ifp-muted))" }}>
                Status
              </span>
              {prof.ativo ? (
                <Badge variant="success">Ativo</Badge>
              ) : (
                <Badge variant="default">Inativo</Badge>
              )}
            </div>
          </Card>

          <Card>
            <h3
              className="mb-3 text-sm font-bold tracking-wide"
              style={{ color: "rgb(var(--ifp-ink))" }}
            >
              Templates de agenda
            </h3>
            {prof.templates.length === 0 ? (
              <p className="text-sm" style={{ color: "rgb(var(--ifp-muted))" }}>
                Nenhum template ativo. O próprio profissional configura em{" "}
                <strong>Minha agenda</strong>.
              </p>
            ) : (
              <ul className="space-y-2">
                {prof.templates.map((t) => (
                  <li
                    key={t.id}
                    className="rounded-[var(--ifp-radius-sm)] border px-3 py-2 text-sm"
                    style={{
                      borderColor: "rgb(var(--ifp-surface-200))",
                      borderLeft: `3px solid ${t.especialidade.corDestaque}`,
                    }}
                  >
                    <p className="font-medium" style={{ color: "rgb(var(--ifp-ink))" }}>
                      {t.especialidade.nome}
                    </p>
                    <p className="text-xs" style={{ color: "rgb(var(--ifp-muted))" }}>
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
