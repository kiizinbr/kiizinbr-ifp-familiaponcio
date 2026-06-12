import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { podeVerProntuario } from "@/lib/medico/rbac";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/audit";
import { MedicoShell, MedicoHeader } from "@/components/medico/medico-shell";
import { Card } from "@/components/ui/card";
import { calcularImc, SELECT_CONTEXTO_PACIENTE } from "@/lib/medico/prontuario";
import { chipsClinicos } from "@/lib/texto-clinico";

const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

function idade(d: Date | null): number | null {
  if (!d) return null;
  const h = new Date();
  let a = h.getFullYear() - d.getFullYear();
  const m = h.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && h.getDate() < d.getDate())) a--;
  return a;
}

function pa(s: number | null, d: number | null): string | null {
  if (s == null && d == null) return null;
  return `${s ?? "—"}/${d ?? "—"}`;
}

/**
 * Linha do tempo clínica do paciente: todas as notas ASSINADAS (o registro oficial)
 * num só lugar, fora da consulta atual + a série de sinais vitais. É o que separa
 * "bloco de notas" de "prontuário". Acesso registrado em audit (LGPD art. 11).
 */
export default async function PacienteTimelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session) redirect("/medico/login" as Route);
  if (!canAccessUnidade(session, "medico")) redirect("/" as Route);
  if (!podeVerProntuario(session)) redirect("/medico" as Route);

  const cidadao = await db.cidadao.findUnique({
    where: { id },
    // Select compartilhado com o teste de integração: o campo real do model é
    // `medicamentosEmUso` (não `medicamentos`) e tsc não pega select errado.
    select: SELECT_CONTEXTO_PACIENTE,
  });
  if (!cidadao) notFound();

  const notas = await db.notaEvolucao.findMany({
    where: { cidadaoId: id, status: "assinada" },
    include: {
      consulta: {
        include: {
          especialidade: { select: { nome: true } },
          slot: { select: { dataHoraInicio: true } },
        },
      },
      profissional: { select: { nomeExibicao: true } },
      diagnosticos: true,
    },
    // Ordena pela data CLÍNICA do atendimento (slot.dataHoraInicio) — NUNCA por
    // NotaEvolucao.createdAt: nas ~94k notas migradas da Amplimed, createdAt é
    // a data em que a migração RODOU, não a data da consulta.
    orderBy: { consulta: { slot: { dataHoraInicio: "desc" } } },
  });

  await logEvent({
    userId: session.user.id,
    action: "medical_data_accessed",
    entityType: "timeline_clinica",
    rootEntityType: "cidadao",
    rootEntityId: id,
    meta: { notas: notas.length },
  });

  const nome = cidadao.nomeSocial || cidadao.nomeCompleto;
  const serie = [...notas]
    .reverse()
    .filter((n) => n.pesoKg != null || n.paSistolica != null)
    .map((n) => {
      const peso = n.pesoKg != null ? Number(n.pesoKg) : null;
      return {
        data: n.consulta.slot.dataHoraInicio,
        pa: pa(n.paSistolica, n.paDiastolica),
        peso,
        imc: calcularImc(peso, n.alturaCm),
      };
    });

  // chipsClinicos limpa o HTML legado da Amplimed (`<br>` literal etc.) antes
  // de dividir — exibição apenas; a fonte não é reescrita nesta sprint.
  const alergias = chipsClinicos(cidadao.alergias);
  const cronicas = chipsClinicos(cidadao.condicoesCronicas);
  const medicamentos = chipsClinicos(cidadao.medicamentosEmUso);

  return (
    <MedicoShell session={session}>
      <MedicoHeader
        eyebrow="Centro Médico · Histórico"
        titulo={nome}
        descricao={`${idade(cidadao.dataNascimento) ?? "—"} anos${cidadao.genero ? ` · ${cidadao.genero}` : ""} · ${notas.length} atendimento(s) registrado(s).`}
        acao={
          <Link href={`/app/cidadaos/${cidadao.id}` as Route} className="btn btn-secondary">
            Ficha completa
          </Link>
        }
      />

      <Card>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 13 }}>
          <Ctx label="Tipo sanguíneo" valor={cidadao.tipoSanguineo} />
          <Ctx label="Alergias" valor={alergias.length ? alergias.join(", ") : null} alerta />
          <Ctx label="Condições crônicas" valor={cronicas.length ? cronicas.join(", ") : null} />
          <Ctx label="Medicamentos" valor={medicamentos.length ? medicamentos.join(", ") : null} />
        </div>
      </Card>

      {serie.length > 0 && (
        <Card>
          <p style={{ fontWeight: 700, marginBottom: 10, color: "var(--text)" }}>
            Sinais vitais ao longo do tempo
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "var(--text-3)", textAlign: "left" }}>
                <th style={{ padding: "4px 8px 4px 0" }}>Data</th>
                <th style={{ padding: "4px 8px" }}>PA</th>
                <th style={{ padding: "4px 8px" }}>Peso</th>
                <th style={{ padding: "4px 8px" }}>IMC</th>
              </tr>
            </thead>
            <tbody>
              {serie.map((s, i) => (
                <tr key={i} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ padding: "5px 8px 5px 0" }}>{fmt.format(s.data)}</td>
                  <td className="mono" style={{ padding: "5px 8px" }}>
                    {s.pa ?? "—"}
                  </td>
                  <td className="mono" style={{ padding: "5px 8px" }}>
                    {s.peso != null ? `${s.peso} kg` : "—"}
                  </td>
                  <td className="mono" style={{ padding: "5px 8px" }}>
                    {s.imc ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {notas.length === 0 ? (
        <Card>
          <p style={{ color: "var(--text-3)" }}>Nenhum atendimento clínico registrado ainda.</p>
        </Card>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {notas.map((n) => {
            const peso = n.pesoKg != null ? Number(n.pesoKg) : null;
            const imc = calcularImc(peso, n.alturaCm);
            const vitais = [
              pa(n.paSistolica, n.paDiastolica) ? `PA ${pa(n.paSistolica, n.paDiastolica)}` : null,
              n.fcBpm != null ? `FC ${n.fcBpm}` : null,
              peso != null ? `${peso} kg` : null,
              imc != null ? `IMC ${imc}` : null,
              n.spo2 != null ? `SpO₂ ${n.spo2}%` : null,
            ].filter(Boolean);
            return (
              <Card key={n.id}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <span style={{ fontWeight: 700, color: "var(--text)" }}>
                    {fmt.format(n.consulta.slot.dataHoraInicio)} · {n.consulta.especialidade.nome}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                    {n.profissional.nomeExibicao}
                  </span>
                </div>
                {n.diagnosticos.length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                    {n.diagnosticos.map((d) => (
                      <span
                        key={d.id}
                        className="mono"
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: "var(--surface-2)",
                          color: "var(--text-3)",
                        }}
                      >
                        {d.codigoCid ? `${d.codigoCid} ` : ""}
                        {d.descricao}
                        {d.principal ? " ★" : ""}
                      </span>
                    ))}
                  </div>
                )}
                {n.texto && (
                  <p style={{ fontSize: 13, color: "var(--text)", whiteSpace: "pre-wrap" }}>
                    {n.texto}
                  </p>
                )}
                {vitais.length > 0 && (
                  <p
                    className="mono"
                    style={{ marginTop: 6, fontSize: 12, color: "var(--text-3)" }}
                  >
                    {vitais.join(" · ")}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </MedicoShell>
  );
}

function Ctx({ label, valor, alerta }: { label: string; valor: string | null; alerta?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--text-3)" }}>{label}</div>
      <div
        style={{
          color: valor ? (alerta ? "var(--danger)" : "var(--text)") : "var(--text-3)",
          fontWeight: alerta && valor ? 700 : 400,
        }}
      >
        {valor ?? "—"}
      </div>
    </div>
  );
}
