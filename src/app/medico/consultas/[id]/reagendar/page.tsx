import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { podeMarcarConsulta } from "@/lib/medico/rbac";
import { assertAcessoCidadao } from "@/lib/cidadao-authz";
import { db } from "@/lib/db";
import { MedicoShell, MedicoHeader } from "@/components/medico/medico-shell";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { STATUS_REAGENDAVEL } from "@/lib/medico/agenda";
import { reagendarConsultaAction } from "../reagendar-action";

/** Escolha do novo horário (reagendar em 1 passo). Mirror do passo 3 do wizard. */
export default async function ReagendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { id } = await params;
  const { erro } = await searchParams;
  const session = await auth();
  if (!session) redirect("/medico/login" as Route);
  if (!canAccessUnidade(session, "medico")) redirect("/" as Route);
  if (!podeMarcarConsulta(session)) redirect("/medico" as Route);

  const consulta = await db.consulta.findUnique({
    where: { id },
    include: {
      cidadao: { select: { nomeCompleto: true, nomeSocial: true } },
      especialidade: { select: { id: true, nome: true } },
      slot: { select: { id: true, dataHoraInicio: true } },
    },
  });
  if (!consulta) notFound();

  // A1 IDOR guard (read-side): o gate de rota/papel NÃO confere a unidade do
  // OBJETO. Esta tela vaza nome do paciente e permite reagendar consulta de
  // outra unidade. Exige acesso à unidade do cidadão (catch → notFound).
  try {
    await assertAcessoCidadao(session, consulta.cidadaoId, "edit");
  } catch {
    notFound();
  }

  if (!STATUS_REAGENDAVEL.has(consulta.status)) {
    redirect(`/medico/consultas/${id}?erro=nao_reagendavel` as Route);
  }

  const nomePac = consulta.cidadao.nomeSocial || consulta.cidadao.nomeCompleto;

  const slots = await db.slot.findMany({
    where: {
      especialidadeId: consulta.especialidadeId,
      status: "disponivel",
      dataHoraInicio: { gte: new Date() },
      id: { not: consulta.slotId },
    },
    include: { profissional: true },
    orderBy: { dataHoraInicio: "asc" },
    take: 24,
  });

  const porDia = new Map<string, typeof slots>();
  for (const s of slots) {
    const k = s.dataHoraInicio.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    });
    if (!porDia.has(k)) porDia.set(k, []);
    porDia.get(k)!.push(s);
  }

  const atual = consulta.slot.dataHoraInicio.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <MedicoShell session={session}>
      <MedicoHeader
        eyebrow={`Reagendar · ${nomePac} · ${consulta.especialidade.nome}`}
        titulo="Escolher novo horário"
        descricao={`Atual: ${atual}. Selecione o novo horário — o anterior é liberado automaticamente.`}
        acao={
          <Link href={`/medico/consultas/${id}` as Route} className="btn btn-secondary">
            ← Voltar
          </Link>
        }
      />

      {erro === "slot_indisponivel" && (
        <div
          className="mb-4 rounded-[var(--r-md)] border px-4 py-3 text-sm"
          style={{
            borderColor: "var(--danger)",
            background: "var(--danger-soft)",
            color: "var(--danger)",
          }}
        >
          Esse horário acabou de ser reservado por outra pessoa. Escolha outro abaixo.
        </div>
      )}

      {slots.length === 0 ? (
        <Card>
          <p style={{ color: "var(--text-3)" }}>
            Nenhum outro horário disponível para {consulta.especialidade.nome} nos próximos dias.
          </p>
        </Card>
      ) : (
        <div className="space-y-5">
          {[...porDia.entries()].map(([dia, slotsDoDia]) => (
            <Card key={dia}>
              <p className="mb-3 text-sm font-bold capitalize" style={{ color: "var(--accent)" }}>
                {dia}
              </p>
              <div className="flex flex-wrap gap-2">
                {slotsDoDia.map((s) => (
                  <form key={s.id} action={reagendarConsultaAction}>
                    <input type="hidden" name="consultaId" value={consulta.id} />
                    <input type="hidden" name="slotId" value={s.id} />
                    <SubmitButton
                      variant="ghost"
                      pendingLabel="Reagendando…"
                      className="rounded-[var(--r-md)] border text-left transition hover:border-[var(--accent)] hover:bg-[var(--surface-2)]"
                      style={{
                        display: "block",
                        padding: "8px 12px",
                        fontWeight: 400,
                        lineHeight: 1.4,
                        borderColor: "var(--line)",
                      }}
                      title={`Mover para ${s.dataHoraInicio.toLocaleTimeString("pt-BR")} com ${s.profissional.nomeExibicao}`}
                    >
                      <span
                        className="mono block text-sm font-bold tabular-nums"
                        style={{ color: "var(--text)" }}
                      >
                        {s.dataHoraInicio.toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="block text-[11px]" style={{ color: "var(--text-3)" }}>
                        {s.profissional.nomeExibicao}
                      </span>
                    </SubmitButton>
                  </form>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </MedicoShell>
  );
}
