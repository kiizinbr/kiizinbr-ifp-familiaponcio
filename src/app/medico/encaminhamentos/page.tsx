import { redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { db } from "@/lib/db";
import { MedicoShell, MedicoHeader } from "@/components/medico/medico-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { podeAgendarEncaminhamento, podeEncaminhar } from "@/lib/medico/rbac";
import { cancelarEncaminhamentoAction } from "./actions";

function diasDesde(d: Date): number {
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

export default async function EncaminhamentosPage() {
  const session = await auth();
  if (!session) redirect("/medico/login" as Route);
  if (!canAccessUnidade(session, "medico")) redirect("/" as Route);
  if (!podeAgendarEncaminhamento(session) && !podeEncaminhar(session)) {
    redirect("/medico" as Route);
  }

  const fila = await db.encaminhamento.findMany({
    where: { status: "aguardando_agendamento" },
    include: { cidadao: { select: { nomeCompleto: true } }, especialidade: true },
    orderBy: { createdAt: "asc" },
  });

  const podeAgendar = podeAgendarEncaminhamento(session);
  const podeCancelar = podeEncaminhar(session);

  return (
    <MedicoShell session={session}>
      <MedicoHeader
        eyebrow="Instituto Família Pôncio · Centro Médico"
        titulo="A agendar"
        descricao={`${fila.length} ${
          fila.length === 1 ? "pedido aguardando" : "pedidos aguardando"
        } agendamento`}
      />

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
                      {podeAgendar ? (
                        <Link
                          href={`/medico/consultas/nova?encaminhamentoId=${e.id}` as Route}
                          className="btn btn-primary btn-sm"
                        >
                          Agendar
                        </Link>
                      ) : null}
                      {podeCancelar ? (
                        <form
                          action={cancelarEncaminhamentoAction}
                          style={{ display: "inline", marginLeft: 8 }}
                        >
                          <input type="hidden" name="encaminhamentoId" value={e.id} />
                          <button type="submit" className="btn btn-ghost btn-sm">
                            Cancelar
                          </button>
                        </form>
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
