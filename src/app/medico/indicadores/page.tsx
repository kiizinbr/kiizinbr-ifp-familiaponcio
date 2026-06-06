import { redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { podeGerenciarEspecialidade } from "@/lib/medico/rbac";
import { db } from "@/lib/db";
import { MedicoShell, MedicoHeader } from "@/components/medico/medico-shell";
import { Card } from "@/components/ui/card";
import { calcularIndicadores, taxaOcupacao, contagemDeGroupBy } from "@/lib/medico/indicadores";

const STATUS_CONSULTA = [
  "agendada",
  "confirmada",
  "em_atendimento",
  "realizada",
  "faltou",
  "cancelada",
] as const;
const STATUS_SLOT = [
  "disponivel",
  "reservado",
  "realizado",
  "faltou",
  "bloqueado",
  "cancelado",
] as const;

function Stat({ valor, label, destaque }: { valor: string; label: string; destaque?: boolean }) {
  return (
    <Card>
      <div
        style={{ fontSize: 30, fontWeight: 800, color: destaque ? "var(--accent)" : "var(--text)" }}
      >
        {valor}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{label}</div>
    </Card>
  );
}

function Linha({ label, valor }: { label: string; valor: number }) {
  return (
    <div
      style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13 }}
    >
      <span style={{ color: "var(--text-3)" }}>{label}</span>
      <span className="mono" style={{ color: "var(--text)", fontWeight: 700 }}>
        {valor}
      </span>
    </div>
  );
}

export default async function IndicadoresPage() {
  const session = await auth();
  if (!session) redirect("/medico/login" as Route);
  if (!canAccessUnidade(session, "medico")) redirect("/" as Route);
  if (!podeGerenciarEspecialidade(session)) redirect("/medico" as Route);

  const now = new Date();
  const gte = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const lt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const mesLabel = gte.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const [consultasGroup, slotsGroup, producaoGroup] = await Promise.all([
    db.consulta.groupBy({
      by: ["status"],
      where: { slot: { dataHoraInicio: { gte, lt } } },
      _count: true,
    }),
    db.slot.groupBy({ by: ["status"], where: { dataHoraInicio: { gte, lt } }, _count: true }),
    db.consulta.groupBy({
      by: ["profissionalId", "status"],
      where: { status: { in: ["realizada", "faltou"] }, slot: { dataHoraInicio: { gte, lt } } },
      _count: true,
    }),
  ]);

  const cc = contagemDeGroupBy(consultasGroup, STATUS_CONSULTA);
  const ind = calcularIndicadores(cc);
  const cs = contagemDeGroupBy(slotsGroup, STATUS_SLOT);
  const ocup = taxaOcupacao({
    disponivel: cs.disponivel,
    reservado: cs.reservado,
    realizado: cs.realizado,
    faltou: cs.faltou,
  });

  const prodMap = new Map<string, { realizada: number; faltou: number }>();
  for (const r of producaoGroup) {
    const e = prodMap.get(r.profissionalId) ?? { realizada: 0, faltou: 0 };
    if (r.status === "realizada") e.realizada = r._count;
    if (r.status === "faltou") e.faltou = r._count;
    prodMap.set(r.profissionalId, e);
  }
  const profs = await db.profissional.findMany({
    where: { id: { in: [...prodMap.keys()] } },
    select: { id: true, nomeExibicao: true },
  });
  const producao = profs
    .map((p) => ({ nome: p.nomeExibicao, ...(prodMap.get(p.id) ?? { realizada: 0, faltou: 0 }) }))
    .sort((a, b) => b.realizada - a.realizada);

  return (
    <MedicoShell session={session}>
      <MedicoHeader
        eyebrow="Centro Médico · Gestão"
        titulo="Indicadores"
        descricao={`Período: ${mesLabel}. Comparecimento e falta sobre as consultas que chegaram à hora (realizadas + faltas).`}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <Stat valor={`${ind.taxaComparecimento}%`} label="Comparecimento" destaque />
        <Stat valor={`${ind.taxaFalta}%`} label="Falta (no-show)" />
        <Stat valor={`${ind.taxaCancelamento}%`} label="Cancelamento" />
        <Stat valor={`${ocup}%`} label="Ocupação da agenda" />
      </div>

      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        }}
      >
        <Card>
          <p style={{ fontWeight: 700, marginBottom: 10, color: "var(--text)" }}>
            Consultas no mês ({ind.total})
          </p>
          <Linha label="Realizadas" valor={ind.realizadas} />
          <Linha label="Faltas" valor={ind.faltas} />
          <Linha label="Canceladas" valor={ind.canceladas} />
          <Linha label="Em aberto (agendadas/confirmadas)" valor={ind.ativas} />
        </Card>
        <Card>
          <p style={{ fontWeight: 700, marginBottom: 10, color: "var(--text)" }}>
            Produção por profissional
          </p>
          {producao.length === 0 ? (
            <p style={{ color: "var(--text-3)", fontSize: 13 }}>Sem atendimentos no período.</p>
          ) : (
            producao.map((p) => (
              <div
                key={p.nome}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "5px 0",
                  fontSize: 13,
                }}
              >
                <span style={{ color: "var(--text)" }}>{p.nome}</span>
                <span style={{ color: "var(--text-3)" }}>
                  {p.realizada} atend. · {p.faltou} faltas
                </span>
              </div>
            ))
          )}
        </Card>
      </div>
    </MedicoShell>
  );
}
