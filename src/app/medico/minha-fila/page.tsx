import { redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade, hasAnyRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { MedicoShell, MedicoHeader } from "@/components/medico/medico-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CONSULTA_VISUAL } from "@/lib/medico/ui";
import { transitionAction } from "../consultas/[id]/actions";
import { chamarAction } from "@/app/painel/chamar-actions";

/** Fila do dia do profissional logado: só os pacientes dele, com check-in + iniciar direto. */
export default async function MinhaFilaPage() {
  const session = await auth();
  if (!session) redirect("/medico/login" as Route);
  if (!canAccessUnidade(session, "medico")) redirect("/" as Route);
  if (!hasAnyRole(session, "profissional")) redirect("/medico" as Route);

  const inicioDia = new Date();
  inicioDia.setHours(0, 0, 0, 0);
  const fimDia = new Date();
  fimDia.setHours(23, 59, 59, 999);

  const consultas = await db.consulta.findMany({
    where: {
      profissional: { userId: session.user.id },
      status: { in: ["agendada", "confirmada", "em_atendimento"] },
      slot: { dataHoraInicio: { gte: inicioDia, lte: fimDia } },
    },
    include: {
      slot: { select: { dataHoraInicio: true } },
      cidadao: { select: { id: true, nomeCompleto: true, nomeSocial: true } },
      especialidade: { select: { nome: true } },
      profissional: { select: { nomeExibicao: true } },
    },
    orderBy: { slot: { dataHoraInicio: "asc" } },
  });

  const agora = new Date();

  return (
    <MedicoShell session={session}>
      <MedicoHeader
        eyebrow="Centro Médico"
        titulo="Minha fila de hoje"
        descricao="Seus pacientes do dia. Quem já chegou aparece com o tempo de espera; toque em Iniciar para começar."
      />

      {consultas.length === 0 ? (
        <Card>
          <p style={{ color: "var(--text-3)" }}>Nenhuma consulta sua para hoje.</p>
        </Card>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {consultas.map((c) => {
            const hora = c.slot.dataHoraInicio.toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            });
            const visual = CONSULTA_VISUAL[c.status];
            const espera =
              c.checkinEm && c.status !== "em_atendimento"
                ? Math.max(0, Math.floor((agora.getTime() - c.checkinEm.getTime()) / 60000))
                : null;
            const podeIniciar = c.status === "agendada" || c.status === "confirmada";
            return (
              <Card key={c.id}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <span className="mono" style={{ fontWeight: 700, color: "var(--text)" }}>
                      {hora}
                    </span>{" "}
                    <Link
                      href={`/medico/consultas/${c.id}` as Route}
                      style={{ color: "var(--text)", fontWeight: 600 }}
                    >
                      {c.cidadao.nomeSocial || c.cidadao.nomeCompleto}
                    </Link>
                    <span style={{ color: "var(--text-3)", fontSize: 12 }}>
                      {" "}
                      · {c.especialidade.nome}
                    </span>
                    {espera != null ? (
                      <span style={{ color: "var(--accent)", fontSize: 12, fontWeight: 600 }}>
                        {" "}
                        · ✓ esperando {espera} min
                      </span>
                    ) : null}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <Badge variant={visual.variant}>{visual.label}</Badge>
                    {podeIniciar ? (
                      <form action={transitionAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="para" value="em_atendimento" />
                        <button type="submit" className="btn btn-primary">
                          Iniciar
                        </button>
                      </form>
                    ) : (
                      <Link
                        href={`/medico/consultas/${c.id}` as Route}
                        className="btn btn-secondary"
                      >
                        Abrir
                      </Link>
                    )}
                    <form action={chamarAction}>
                      <input type="hidden" name="unidade" value="medico" />
                      <input
                        type="hidden"
                        name="nomeChamado"
                        value={c.cidadao.nomeSocial || c.cidadao.nomeCompleto}
                      />
                      <input type="hidden" name="destino" value={c.profissional.nomeExibicao} />
                      <input type="hidden" name="cidadaoId" value={c.cidadao.id} />
                      <input type="hidden" name="consultaId" value={c.id} />
                      <button type="submit" className="btn btn-secondary">
                        Chamar
                      </button>
                    </form>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </MedicoShell>
  );
}
