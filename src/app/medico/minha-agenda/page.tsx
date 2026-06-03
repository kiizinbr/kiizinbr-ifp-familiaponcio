import { redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade, hasAnyRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { MedicoShell, MedicoHeader } from "@/components/medico/medico-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatarDiasSemana, SLOT_VISUAL } from "@/lib/medico/ui";
import { criarTemplateAction, bloquearSlotAction, desbloquearSlotAction } from "./actions";

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const fieldCls = "input mt-1";
const dayChipCls =
  "flex cursor-pointer items-center gap-1.5 rounded-[var(--r-sm)] border px-2.5 py-1.5 text-sm capitalize transition hover:bg-[var(--surface-sunken)]";

export default async function MinhaAgendaPage() {
  const session = await auth();
  if (!session) redirect("/medico/login" as Route);
  if (!canAccessUnidade(session, "medico")) redirect("/" as Route);

  if (!hasAnyRole(session, "profissional", "super_admin")) {
    return (
      <MedicoShell session={session}>
        <MedicoHeader titulo="Minha agenda" />
        <Card>
          <EmptyState
            titulo="Você não tem agenda própria"
            descricao="Esta área é dos profissionais que atendem. Veja as agendas em Agenda semanal."
          />
        </Card>
      </MedicoShell>
    );
  }

  const prof = await db.profissional.findUnique({
    where: { userId: session.user.id },
    include: {
      templates: {
        where: { ativo: true },
        include: { especialidade: true },
        orderBy: { createdAt: "desc" },
      },
      especialidades: { include: { especialidade: true } },
    },
  });

  if (!prof) {
    return (
      <MedicoShell session={session}>
        <MedicoHeader titulo="Minha agenda" />
        <Card>
          <EmptyState
            titulo="Seu usuário ainda não é um profissional"
            descricao="Peça à gestão pra cadastrar você como profissional do Centro Médico."
          />
        </Card>
      </MedicoShell>
    );
  }

  const proxSlots = await db.slot.findMany({
    where: { profissionalId: prof.id, dataHoraInicio: { gte: new Date() } },
    include: { consulta: { include: { cidadao: true } }, especialidade: true },
    orderBy: { dataHoraInicio: "asc" },
    take: 40,
  });

  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <MedicoShell session={session}>
      <MedicoHeader
        eyebrow="Self-service"
        titulo="Minha agenda"
        descricao="Defina seus dias e horários de atendimento. Os slots são gerados automaticamente."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
        {/* Coluna esquerda: templates + novo */}
        <div className="space-y-6">
          <Card accent="medico">
            <h2 className="t-h3 text-sm font-bold tracking-wide">
              Templates ativos ({prof.templates.length})
            </h2>
            {prof.templates.length === 0 ? (
              <p className="text-3 mt-3 text-sm">
                Nenhum template ainda. Crie abaixo para gerar slots.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {prof.templates.map((t) => (
                  <li
                    key={t.id}
                    className="rounded-[var(--r-sm)] border px-3 py-2 text-sm"
                    style={{
                      borderColor: "var(--line)",
                      borderLeft: `3px solid ${t.especialidade.corDestaque}`,
                    }}
                  >
                    <p className="font-medium">{t.especialidade.nome}</p>
                    <p className="text-3 text-xs">
                      {formatarDiasSemana(t.diasSemana)} · {t.faixaInicio}–{t.faixaFim} ·{" "}
                      {t.duracaoSlotMin}min
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="t-h3 mb-4 text-sm font-bold tracking-wide">Novo template</h2>
            <form action={criarTemplateAction} className="space-y-4">
              <fieldset>
                <legend className="label">Dias da semana</legend>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {DIAS.map((label, idx) => (
                    <label key={idx} className={dayChipCls} style={{ borderColor: "var(--line)" }}>
                      <input
                        type="checkbox"
                        name="diasSemana"
                        value={idx}
                        className="accent-[var(--accent)]"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className="label">Início</span>
                  <input
                    name="faixaInicio"
                    type="time"
                    required
                    defaultValue="14:00"
                    className={fieldCls}
                  />
                </label>
                <label className="block">
                  <span className="label">Fim</span>
                  <input
                    name="faixaFim"
                    type="time"
                    required
                    defaultValue="18:00"
                    className={fieldCls}
                  />
                </label>
                <label className="block">
                  <span className="label">Slot (min)</span>
                  <input
                    name="duracaoSlotMin"
                    type="number"
                    min={10}
                    step={5}
                    required
                    defaultValue={30}
                    className={fieldCls}
                  />
                </label>
              </div>

              <label className="block">
                <span className="label">Especialidade</span>
                <select name="especialidadeId" required defaultValue="" className="select mt-1">
                  <option value="" disabled>
                    — escolha —
                  </option>
                  {prof.especialidades.map((pe) => (
                    <option key={pe.especialidadeId} value={pe.especialidadeId}>
                      {pe.especialidade.nome}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="label">Válido de</span>
                  <input
                    name="validoDe"
                    type="date"
                    required
                    defaultValue={hoje}
                    className={fieldCls}
                  />
                </label>
                <label className="block">
                  <span className="label">Até (vazio = 90d)</span>
                  <input name="validoAte" type="date" className={fieldCls} />
                </label>
              </div>

              <button type="submit" className="btn btn-primary btn-block">
                Criar template e gerar slots
              </button>
            </form>
          </Card>
        </div>

        {/* Coluna direita: próximos slots */}
        <Card className="!p-0">
          <div className="border-b px-6 py-4" style={{ borderColor: "var(--line)" }}>
            <h2 className="t-h3 text-sm font-bold tracking-wide">Próximos slots</h2>
          </div>
          {proxSlots.length === 0 ? (
            <EmptyState
              titulo="Sem slots futuros"
              descricao="Crie um template para gerar sua agenda."
            />
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--line)" }}>
              {proxSlots.map((s) => {
                const visual = SLOT_VISUAL[s.status];
                return (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-6 py-3">
                    <div className="flex items-center gap-3">
                      <span
                        className="h-8 w-1 shrink-0 rounded-full"
                        style={{ background: s.especialidade.corDestaque }}
                        aria-hidden
                      />
                      <div>
                        <p className="mono text-sm font-semibold tabular-nums">
                          {s.dataHoraInicio.toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        <p className="text-3 text-xs">
                          {s.consulta?.cidadao.nomeCompleto ?? s.especialidade.nome}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={visual.variant}>{visual.label}</Badge>
                      {s.status === "disponivel" && (
                        <form action={bloquearSlotAction} className="flex items-center gap-1">
                          <input type="hidden" name="slotId" value={s.id} />
                          <input
                            type="text"
                            name="motivo"
                            placeholder="motivo"
                            required
                            className="input w-24 px-2 py-1 text-xs"
                          />
                          <button
                            type="submit"
                            className="btn btn-ghost btn-sm"
                            style={{ color: "var(--warn)" }}
                          >
                            Bloquear
                          </button>
                        </form>
                      )}
                      {s.status === "bloqueado" && (
                        <form action={desbloquearSlotAction}>
                          <input type="hidden" name="slotId" value={s.id} />
                          <button
                            type="submit"
                            className="btn btn-ghost btn-sm"
                            style={{ color: "var(--accent)" }}
                          >
                            Liberar
                          </button>
                        </form>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </MedicoShell>
  );
}
