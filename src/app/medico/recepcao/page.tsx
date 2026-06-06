import { redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { podeMarcarConsulta } from "@/lib/medico/rbac";
import { db } from "@/lib/db";
import { MedicoShell, MedicoHeader } from "@/components/medico/medico-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCpf } from "@/lib/cpf";
import { CONSULTA_VISUAL } from "@/lib/medico/ui";
import { STATUS_REAGENDAVEL } from "@/lib/medico/agenda";
import { transitionAction } from "../consultas/[id]/actions";
import { marcarCheckinAction } from "../consultas/[id]/checkin-action";

/** Balcão único da recepção: busca o paciente + agenda do dia com ações inline. */
export default async function RecepcaoPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/medico/login" as Route);
  if (!canAccessUnidade(session, "medico")) redirect("/" as Route);
  if (!podeMarcarConsulta(session)) redirect("/medico" as Route);

  const { q } = await searchParams;
  const inicioDia = new Date();
  inicioDia.setHours(0, 0, 0, 0);
  const fimDia = new Date();
  fimDia.setHours(23, 59, 59, 999);

  const digits = q?.replace(/\D/g, "") ?? "";
  const matches = q
    ? await db.cidadao.findMany({
        where: {
          deletedAt: null,
          OR: [
            { nomeCompleto: { contains: q, mode: "insensitive" } },
            { telefonePrincipal: { contains: q } },
            ...(digits ? [{ cpf: { contains: digits } }] : []),
          ],
        },
        take: 6,
        orderBy: { nomeCompleto: "asc" },
      })
    : [];

  const consultas = await db.consulta.findMany({
    where: { slot: { dataHoraInicio: { gte: inicioDia, lte: fimDia } } },
    include: {
      slot: { select: { dataHoraInicio: true } },
      cidadao: { select: { nomeCompleto: true, nomeSocial: true } },
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
        titulo="Recepção"
        descricao="Busque o paciente, faça check-in, confirme ou reagende — tudo do balcão."
        acao={
          <Link href={"/medico/consultas/nova" as Route} className="btn btn-primary">
            + Marcar consulta
          </Link>
        }
      />

      <Card>
        <form method="get" style={{ display: "flex", gap: 8 }}>
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar paciente por nome, CPF ou telefone"
            className="input"
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-secondary">
            Buscar
          </button>
        </form>
        {q && matches.length === 0 ? (
          <p style={{ marginTop: 10, fontSize: 13, color: "var(--text-3)" }}>
            Ninguém encontrado.{" "}
            <Link href={"/app/cidadaos/novo" as Route} style={{ color: "var(--accent)" }}>
              Cadastrar
            </Link>
          </p>
        ) : null}
        {matches.length > 0 ? (
          <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
            {matches.map((c) => (
              <Link
                key={c.id}
                href={`/medico/consultas/nova?cidadaoId=${c.id}` as Route}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                  textDecoration: "none",
                }}
              >
                <span style={{ color: "var(--text)", fontWeight: 600 }}>{c.nomeCompleto}</span>
                <span className="mono" style={{ color: "var(--text-3)", fontSize: 12 }}>
                  {formatCpf(c.cpf)} · {c.telefonePrincipal}
                </span>
              </Link>
            ))}
          </div>
        ) : null}
      </Card>

      <h2 className="t-h2" style={{ color: "var(--text)", margin: "20px 0 12px" }}>
        Agenda de hoje ({consultas.length})
      </h2>
      {consultas.length === 0 ? (
        <Card>
          <p style={{ color: "var(--text-3)" }}>Sem consultas hoje.</p>
        </Card>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
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
            const ativa = c.status === "agendada" || c.status === "confirmada";
            const podeConfirmar = c.status === "agendada";
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
                  <div style={{ minWidth: 0 }}>
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
                      · {c.especialidade.nome} · {c.profissional.nomeExibicao}
                    </span>
                    {espera != null ? (
                      <span style={{ color: "var(--accent)", fontSize: 12, fontWeight: 600 }}>
                        {" "}
                        · ✓ esperando {espera} min
                      </span>
                    ) : null}
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <Badge variant={visual.variant}>{visual.label}</Badge>
                    {ativa && !c.checkinEm ? (
                      <form action={marcarCheckinAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="voltar" value="/medico/recepcao" />
                        <button type="submit" className="btn btn-secondary">
                          Chegou
                        </button>
                      </form>
                    ) : null}
                    {podeConfirmar ? (
                      <form action={transitionAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="para" value="confirmada" />
                        <button type="submit" className="btn btn-secondary">
                          Confirmar
                        </button>
                      </form>
                    ) : null}
                    {STATUS_REAGENDAVEL.has(c.status) ? (
                      <Link
                        href={`/medico/consultas/${c.id}/reagendar` as Route}
                        className="btn btn-secondary"
                      >
                        Reagendar
                      </Link>
                    ) : null}
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
