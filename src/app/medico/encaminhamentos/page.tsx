import { redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { db } from "@/lib/db";
import { MedicoShell, MedicoHeader } from "@/components/medico/medico-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { SubmitButton } from "@/components/ui/submit-button";
import { podeAgendarEncaminhamento, podeEncaminhar } from "@/lib/medico/rbac";
import { encaixarEncaminhamentoAction } from "./actions";
import { CancelarEncaminhamentoButton } from "./cancelar-button";

const ENC_ERROS: Record<string, string> = {
  encaixe: "Não foi possível encaixar (encaminhamento já agendado ou cancelado).",
  sem_slot: "Nenhum horário disponível para encaixe nessa especialidade.",
  encaixe_corrida: "Esse horário acabou de ser reservado. Tente de novo.",
};

function diasDesde(d: Date): number {
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

export default async function EncaminhamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/medico/login" as Route);
  if (!canAccessUnidade(session, "medico")) redirect("/" as Route);
  if (!podeAgendarEncaminhamento(session) && !podeEncaminhar(session)) {
    redirect("/medico" as Route);
  }

  const { erro } = await searchParams;

  const fila = await db.encaminhamento.findMany({
    where: { status: "aguardando_agendamento" },
    include: { cidadao: { select: { nomeCompleto: true } }, especialidade: true },
    orderBy: { createdAt: "asc" },
  });

  const podeAgendar = podeAgendarEncaminhamento(session);
  const podeCancelar = podeEncaminhar(session);

  const espIds = [...new Set(fila.map((e) => e.especialidadeId))];
  const slotsDisp = espIds.length
    ? await db.slot.findMany({
        where: {
          especialidadeId: { in: espIds },
          status: "disponivel",
          dataHoraInicio: { gte: new Date() },
        },
        orderBy: { dataHoraInicio: "asc" },
        select: { especialidadeId: true, dataHoraInicio: true },
      })
    : [];
  const proxSlot = new Map<string, Date>();
  for (const s of slotsDisp) {
    if (!proxSlot.has(s.especialidadeId)) proxSlot.set(s.especialidadeId, s.dataHoraInicio);
  }

  return (
    <MedicoShell session={session}>
      <MedicoHeader
        eyebrow="Instituto Família Pôncio · Centro Médico"
        titulo="A agendar"
        descricao={`${fila.length} ${
          fila.length === 1 ? "pedido aguardando" : "pedidos aguardando"
        } agendamento`}
      />

      {erro && ENC_ERROS[erro] ? (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid var(--danger)",
            color: "var(--danger)",
            fontSize: 13,
          }}
        >
          {ENC_ERROS[erro]}
        </div>
      ) : null}

      {fila.length === 0 ? (
        <EmptyState
          titulo="Nada na fila"
          descricao="Nenhum encaminhamento aguardando agendamento. Os pedidos do clínico aparecem aqui."
        />
      ) : (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Cidadão</th>
                <th>Especialidade</th>
                <th>Motivo</th>
                <th>Espera</th>
                <th style={{ textAlign: "right" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {fila.map((e) => {
                const dias = diasDesde(e.createdAt);
                return (
                  <tr key={e.id}>
                    <td className="cell-strong">{e.cidadao.nomeCompleto}</td>
                    <td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: e.especialidade.corDestaque,
                            flex: "none",
                          }}
                        />
                        {e.especialidade.nome}
                      </span>
                    </td>
                    <td style={{ color: "var(--text-3)", maxWidth: 280 }}>{e.motivo ?? "—"}</td>
                    <td className="cell-mono">
                      {dias === 0 ? "hoje" : `há ${dias} ${dias === 1 ? "dia" : "dias"}`}
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      {podeAgendar && proxSlot.has(e.especialidadeId) ? (
                        <form
                          action={encaixarEncaminhamentoAction}
                          style={{ display: "inline", marginRight: 8 }}
                        >
                          <input type="hidden" name="encaminhamentoId" value={e.id} />
                          <SubmitButton variant="secondary" size="sm" pendingLabel="Encaixando…">
                            Encaixar{" "}
                            {proxSlot.get(e.especialidadeId)!.toLocaleString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </SubmitButton>
                        </form>
                      ) : null}
                      {podeAgendar ? (
                        <Link
                          href={`/medico/consultas/nova?encaminhamentoId=${e.id}` as Route}
                          className="btn btn-primary btn-sm"
                        >
                          Agendar
                        </Link>
                      ) : null}
                      {podeCancelar ? (
                        <span style={{ display: "inline-block", marginLeft: 8 }}>
                          <CancelarEncaminhamentoButton encaminhamentoId={e.id} />
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </MedicoShell>
  );
}
