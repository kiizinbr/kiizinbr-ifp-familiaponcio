import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { db } from "@/lib/db";
import { MedicoShell, MedicoHeader } from "@/components/medico/medico-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCpf } from "@/lib/cpf";
import { podeTransicionarConsulta } from "@/lib/medico/rbac";
import { CONSULTA_VISUAL, PROXIMOS_STATUS_CONSULTA } from "@/lib/medico/ui";
import { transitionAction, cancelAction } from "./actions";

const ACAO_LABEL: Record<string, string> = {
  confirmada: "Confirmar",
  em_atendimento: "Iniciar atendimento",
  realizada: "Marcar realizada",
  faltou: "Marcar falta",
};

export default async function ConsultaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) redirect("/medico/login" as Route);
  if (!canAccessUnidade(session, "medico")) redirect("/" as Route);

  const consulta = await db.consulta.findUnique({
    where: { id },
    include: {
      slot: true,
      cidadao: true,
      profissional: { include: { user: true } },
      especialidade: true,
    },
  });
  if (!consulta) notFound();

  const visual = CONSULTA_VISUAL[consulta.status];
  const proximos = PROXIMOS_STATUS_CONSULTA[consulta.status];
  const naoCancelados = proximos.filter((p) => p !== "cancelada");
  const podeCancelar = proximos.includes("cancelada");
  const cor = consulta.especialidade.corDestaque;

  return (
    <MedicoShell session={session}>
      <MedicoHeader
        eyebrow="Consulta"
        titulo={consulta.cidadao.nomeCompleto}
        descricao={`${consulta.slot.dataHoraInicio.toLocaleString("pt-BR", {
          weekday: "long",
          day: "2-digit",
          month: "long",
          hour: "2-digit",
          minute: "2-digit",
        })}`}
        acao={<Badge variant={visual.variant}>{visual.label}</Badge>}
      />

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* Coluna principal */}
        <div className="space-y-6">
          {/* Ações de transição */}
          {(naoCancelados.length > 0 || podeCancelar) && (
            <Card accent="medico">
              <h2
                className="mb-4 text-sm font-bold tracking-wide"
                style={{ color: "rgb(var(--ifp-ink))" }}
              >
                Avançar atendimento
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                {naoCancelados.map((p) => {
                  const permitido = podeTransicionarConsulta(
                    session,
                    consulta.status,
                    p,
                    consulta.profissional.userId,
                  );
                  return (
                    <form key={p} action={transitionAction}>
                      <input type="hidden" name="id" value={consulta.id} />
                      <input type="hidden" name="para" value={p} />
                      <button
                        type="submit"
                        disabled={!permitido}
                        className="rounded-[var(--ifp-radius-md)] px-4 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                        style={{ backgroundColor: "rgb(var(--ifp-teal-700))" }}
                      >
                        {ACAO_LABEL[p] ?? p}
                      </button>
                    </form>
                  );
                })}
                {podeCancelar && (
                  <form action={cancelAction} className="flex items-center gap-1.5">
                    <input type="hidden" name="id" value={consulta.id} />
                    <input
                      type="text"
                      name="motivo"
                      placeholder="motivo do cancelamento"
                      required
                      className="rounded-[var(--ifp-radius-sm)] border px-2.5 py-2 text-sm focus:border-[rgb(var(--ifp-danger))] focus:outline-none"
                      style={{ borderColor: "rgb(var(--ifp-surface-200))" }}
                    />
                    <button
                      type="submit"
                      disabled={
                        !podeTransicionarConsulta(
                          session,
                          consulta.status,
                          "cancelada",
                          consulta.profissional.userId,
                        )
                      }
                      className="rounded-[var(--ifp-radius-md)] border px-4 py-2 text-sm font-bold transition hover:bg-[rgb(var(--ifp-danger)/0.06)] disabled:opacity-40"
                      style={{
                        borderColor: "rgb(var(--ifp-danger))",
                        color: "rgb(var(--ifp-danger))",
                      }}
                    >
                      Cancelar
                    </button>
                  </form>
                )}
              </div>
            </Card>
          )}

          {/* Observações */}
          <Card>
            <h2
              className="mb-3 text-sm font-bold tracking-wide"
              style={{ color: "rgb(var(--ifp-ink))" }}
            >
              Observações do agendamento
            </h2>
            <p style={{ color: "rgb(var(--ifp-ink))" }}>
              {consulta.observacoesAgendamento || "Nenhuma observação registrada."}
            </p>
          </Card>

          {/* Placeholder prontuário (F1.B.2) */}
          <Card>
            <div className="flex items-center gap-2">
              <h2
                className="text-sm font-bold tracking-wide"
                style={{ color: "rgb(var(--ifp-ink))" }}
              >
                Prontuário
              </h2>
              <Badge variant="default">Em breve</Badge>
            </div>
            <p className="mt-2 text-sm" style={{ color: "rgb(var(--ifp-muted))" }}>
              O prontuário em 3 colunas (histórico · evolução · ações) chega no próximo módulo
              (F1.B.2). Por ora, o foco é a agenda e a fila.
            </p>
          </Card>
        </div>

        {/* Sidebar: ficha resumida */}
        <div className="space-y-6">
          <Card style={{ borderTop: `4px solid ${cor}` }}>
            <h3
              className="text-sm font-bold tracking-wide"
              style={{ color: "rgb(var(--ifp-ink))" }}
            >
              Paciente
            </h3>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Nome" value={consulta.cidadao.nomeCompleto} />
              <Row label="CPF" value={formatCpf(consulta.cidadao.cpf)} mono />
              <Row label="Telefone" value={consulta.cidadao.telefonePrincipal} />
            </dl>
            <Link
              href={`/app/cidadaos/${consulta.cidadao.id}` as Route}
              className="mt-4 inline-block text-xs font-semibold"
              style={{ color: "rgb(var(--ifp-teal-700))" }}
            >
              Ver ficha completa →
            </Link>
          </Card>

          <Card>
            <h3
              className="text-sm font-bold tracking-wide"
              style={{ color: "rgb(var(--ifp-ink))" }}
            >
              Atendimento
            </h3>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Profissional" value={consulta.profissional.nomeExibicao} />
              <Row
                label="Especialidade"
                value={
                  <span
                    className="rounded px-2 py-0.5 text-xs font-medium"
                    style={{ background: cor + "1f", color: cor }}
                  >
                    {consulta.especialidade.nome}
                  </span>
                }
              />
              <Row label="Duração" value={`${consulta.slot.duracaoMin} min`} />
            </dl>
          </Card>
        </div>
      </div>
    </MedicoShell>
  );
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt style={{ color: "rgb(var(--ifp-muted))" }}>{label}</dt>
      <dd
        className={mono ? "font-mono text-xs" : "font-medium"}
        style={{ color: "rgb(var(--ifp-ink))" }}
      >
        {value}
      </dd>
    </div>
  );
}
