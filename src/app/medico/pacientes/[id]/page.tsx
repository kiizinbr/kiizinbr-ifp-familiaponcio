import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { podeVerProntuario } from "@/lib/medico/rbac";
import { assertAcessoCidadao } from "@/lib/cidadao-authz";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/audit";
import { MedicoShell, MedicoHeader } from "@/components/medico/medico-shell";
import { Card } from "@/components/ui/card";
import { calcularImc, formatVitalSeguro, SELECT_CONTEXTO_PACIENTE } from "@/lib/medico/prontuario";
import { chipsClinicos } from "@/lib/texto-clinico";
import { normalizeTipoSanguineo } from "@/lib/tipo-sanguineo";

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
 * Linha do tempo clínica do paciente: as notas ASSINADAS (o registro oficial)
 * num só lugar, fora da consulta atual + a série de sinais vitais. É o que separa
 * "bloco de notas" de "prontuário". Acesso registrado em audit (LGPD art. 11).
 *
 * Paginação: paciente frequente da Amplimed pode ter centenas de notas
 * assinadas — sem um teto, cada acesso renderiza TODOS os cards + a série de
 * vitais inteira numa página só. "Ver mais" amplia o teto via ?mostrar=N (mesmo
 * espírito do take:5 do histórico da consulta). O take é page-size, não muda a
 * imutabilidade da nota.
 */
const TIMELINE_PAGE = 50;

export default async function PacienteTimelinePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mostrar?: string }>;
}) {
  const { id } = await params;
  const { mostrar } = await searchParams;
  const session = await auth();
  if (!session) redirect("/medico/login" as Route);
  if (!canAccessUnidade(session, "medico")) redirect("/" as Route);
  if (!podeVerProntuario(session)) redirect("/medico" as Route);

  // A1 IDOR guard (PHI): confere acesso à unidade do cidadão ANTES de ler
  // prontuário/vitais e antes do logEvent. throw cross-unidade → notFound() pra
  // não vazar a existência do paciente de outra unidade.
  try {
    await assertAcessoCidadao(session, id, "view");
  } catch {
    notFound();
  }

  const cidadao = await db.cidadao.findUnique({
    where: { id },
    // Select compartilhado com o teste de integração: o campo real do model é
    // `medicamentosEmUso` (não `medicamentos`) e tsc não pega select errado.
    select: SELECT_CONTEXTO_PACIENTE,
  });
  if (!cidadao) notFound();

  // Teto de cards solicitado (múltiplos de TIMELINE_PAGE). Puxa +1 pra saber se
  // há mais notas além do teto sem um count() extra.
  const mostrarN = (() => {
    const n = Number.parseInt(mostrar ?? "", 10);
    if (!Number.isFinite(n) || n < TIMELINE_PAGE) return TIMELINE_PAGE;
    return Math.ceil(n / TIMELINE_PAGE) * TIMELINE_PAGE;
  })();

  const notasPage = await db.notaEvolucao.findMany({
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
    take: mostrarN + 1,
  });
  const temMais = notasPage.length > mostrarN;
  const notas = temMais ? notasPage.slice(0, mostrarN) : notasPage;
  // Total real (index-backed em cidadaoId) só quando há mais que a página — o
  // header/audit reportam o total, não o teto renderizado.
  const totalNotas = temMais
    ? await db.notaEvolucao.count({ where: { cidadaoId: id, status: "assinada" } })
    : notas.length;

  await logEvent({
    userId: session.user.id,
    action: "medical_data_accessed",
    entityType: "timeline_clinica",
    rootEntityType: "cidadao",
    rootEntityId: id,
    meta: { notas: notas.length, total: totalNotas },
  });

  const nome = cidadao.nomeSocial || cidadao.nomeCompleto;
  const serie = [...notas]
    .reverse()
    .filter((n) => n.pesoKg != null || n.paSistolica != null)
    .map((n) => {
      const peso = n.pesoKg != null ? Number(n.pesoKg) : null;
      // Guard display-only (FAIXAS_PLAUSIVEIS): vital migrado absurdo ("7000 kg",
      // "PA 999/999") vira null e a tabela mostra "—" — a nota não é tocada.
      const pesoSeg = formatVitalSeguro("pesoKg", peso) === "—" ? null : peso;
      const sist = formatVitalSeguro("paSistolica", n.paSistolica) === "—" ? null : n.paSistolica;
      const diast =
        formatVitalSeguro("paDiastolica", n.paDiastolica) === "—" ? null : n.paDiastolica;
      return {
        data: n.consulta.slot.dataHoraInicio,
        pa: pa(sist, diast),
        peso: pesoSeg,
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
        descricao={`${idade(cidadao.dataNascimento) ?? "—"} anos${cidadao.genero ? ` · ${cidadao.genero}` : ""} · ${totalNotas} atendimento(s) registrado(s).`}
        acao={
          <Link href={`/app/cidadaos/${cidadao.id}` as Route} className="btn btn-secondary">
            Ficha completa
          </Link>
        }
      />

      <Card>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 13 }}>
          <Ctx
            label="Tipo sanguíneo"
            valor={normalizeTipoSanguineo(cidadao.tipoSanguineo) ?? cidadao.tipoSanguineo}
          />
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
            // Guard display-only nos cards: vital implausível é OMITIDO (lista
            // compacta — diferente da tabela read-only, que mostra "—" no slot
            // fixo). FAIXAS_PLAUSIVEIS é a única fonte; a nota não é tocada.
            const sist =
              formatVitalSeguro("paSistolica", n.paSistolica) === "—" ? null : n.paSistolica;
            const diast =
              formatVitalSeguro("paDiastolica", n.paDiastolica) === "—" ? null : n.paDiastolica;
            const fcSeg = formatVitalSeguro("fcBpm", n.fcBpm);
            const pesoSeg = formatVitalSeguro("pesoKg", peso, " kg");
            const spo2Seg = formatVitalSeguro("spo2", n.spo2, "%");
            const vitais = [
              pa(sist, diast) ? `PA ${pa(sist, diast)}` : null,
              fcSeg !== "—" ? `FC ${fcSeg}` : null,
              pesoSeg !== "—" ? pesoSeg : null,
              imc != null ? `IMC ${imc}` : null,
              spo2Seg !== "—" ? `SpO₂ ${spo2Seg}` : null,
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
          {temMais && (
            <div style={{ textAlign: "center", marginTop: 4 }}>
              <Link
                href={
                  `/medico/pacientes/${cidadao.id}?mostrar=${mostrarN + TIMELINE_PAGE}` as Route
                }
                className="btn btn-secondary"
              >
                Ver mais atendimentos ({totalNotas - notas.length} restantes)
              </Link>
            </div>
          )}
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
