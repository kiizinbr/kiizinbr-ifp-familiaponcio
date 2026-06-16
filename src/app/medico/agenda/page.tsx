import { redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { podeMarcarConsulta } from "@/lib/medico/rbac";
import { db } from "@/lib/db";
import { MedicoShell, MedicoHeader } from "@/components/medico/medico-shell";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { EmptyState } from "@/components/ui/empty-state";
import { corTextoSobre } from "@/lib/medico/ui";
import { agruparSlotsPorDiaLocal, chaveDiaLocal, MAX_SLOTS_SEMANA } from "@/lib/medico/agenda-grid";

const HORA_INICIO = 7;
const HORA_FIM = 20;
const PX_POR_MIN = 1.4;
const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function inicioSemana(d: Date): Date {
  const x = new Date(d);
  x.setDate(x.getDate() - x.getDay());
  x.setHours(0, 0, 0, 0);
  return x;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function horaCurta(d: Date): string {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default async function AgendaSemanalPage({
  searchParams,
}: {
  searchParams: Promise<{ profissionalId?: string; especialidadeId?: string; semana?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/medico/login" as Route);
  if (!canAccessUnidade(session, "medico")) redirect("/" as Route);

  // FIX 5 — só quem pode marcar consulta (recepção/gestão/social) recebe o atalho
  // de slot vazio (?slotId=); pros demais (ex.: profissional) o submit falharia
  // "Sem permissão", então o slot livre cai no <span> estático.
  const canMarcar = podeMarcarConsulta(session);

  const sp = await searchParams;
  const refDate = sp.semana ? new Date(sp.semana) : new Date();
  const inicio = inicioSemana(refDate);
  const fim = new Date(inicio);
  fim.setDate(fim.getDate() + 7);

  const semanaAnterior = new Date(inicio);
  semanaAnterior.setDate(semanaAnterior.getDate() - 7);
  const semanaProxima = new Date(inicio);
  semanaProxima.setDate(semanaProxima.getDate() + 7);

  const [profs, especialidades, slots] = await Promise.all([
    db.profissional.findMany({ where: { ativo: true }, orderBy: { nomeExibicao: "asc" } }),
    db.especialidade.findMany({ where: { ativa: true }, orderBy: { nome: "asc" } }),
    db.slot.findMany({
      where: {
        dataHoraInicio: { gte: inicio, lt: fim },
        ...(sp.profissionalId ? { profissionalId: sp.profissionalId } : {}),
        ...(sp.especialidadeId ? { especialidadeId: sp.especialidadeId } : {}),
      },
      include: {
        profissional: true,
        especialidade: true,
        consulta: { include: { cidadao: true } },
      },
      orderBy: { dataHoraInicio: "asc" },
      // Teto defensivo: a janela da semana já vem do Prisma (gte/lt acima); em
      // operação normal o volume fica muito abaixo disso. Blinda só payload
      // anômalo. Como o orderBy é asc, um eventual truncamento descarta os
      // horários mais tardios. (F8)
      take: MAX_SLOTS_SEMANA,
    }),
  ]);

  // Bucketização O(N) dos slots por dia local — substitui o Array.filter O(7×N)
  // que rodava por coluna. Chave em horário local (espelha o filtro anterior),
  // nunca UTC. (F8)
  const slotsPorDia = agruparSlotsPorDiaLocal(slots);

  // Se o teto defensivo foi atingido, o orderBy asc fez o corte cair nos horários
  // mais tardios da semana (dias finais podem sumir). Numa agenda clínica isso não
  // pode ser silencioso: avisa e orienta a filtrar. (F8)
  const agendaTruncada = slots.length >= MAX_SLOTS_SEMANA;

  const altura = (HORA_FIM - HORA_INICIO) * 60 * PX_POR_MIN;
  const hojeYmd = ymd(new Date());
  const selectCls = "select w-auto";

  const rotuloSemana = `${inicio.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${new Date(fim.getTime() - 86400000).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`;

  return (
    <MedicoShell session={session}>
      <MedicoHeader
        eyebrow={rotuloSemana}
        titulo="Agenda semanal"
        acao={
          <form className="flex items-center gap-2">
            {sp.profissionalId && (
              <input type="hidden" name="profissionalId" value={sp.profissionalId} />
            )}
            {sp.especialidadeId && (
              <input type="hidden" name="especialidadeId" value={sp.especialidadeId} />
            )}
            <a
              href={`/medico/agenda?semana=${ymd(semanaAnterior)}${sp.profissionalId ? `&profissionalId=${sp.profissionalId}` : ""}${sp.especialidadeId ? `&especialidadeId=${sp.especialidadeId}` : ""}`}
              className="btn btn-secondary btn-sm"
              aria-label="Semana anterior"
            >
              ←
            </a>
            <a
              href={`/medico/agenda?semana=${ymd(semanaProxima)}${sp.profissionalId ? `&profissionalId=${sp.profissionalId}` : ""}${sp.especialidadeId ? `&especialidadeId=${sp.especialidadeId}` : ""}`}
              className="btn btn-secondary btn-sm"
              aria-label="Semana seguinte"
            >
              →
            </a>
          </form>
        }
      />

      {/* Filtros */}
      <form method="get" className="mb-5 flex flex-wrap items-center gap-2">
        <input type="hidden" name="semana" value={ymd(inicio)} />
        <select
          name="profissionalId"
          defaultValue={sp.profissionalId ?? ""}
          className={selectCls}
          aria-label="Filtrar por profissional"
        >
          <option value="">Todos os profissionais</option>
          {profs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nomeExibicao}
            </option>
          ))}
        </select>
        <select
          name="especialidadeId"
          defaultValue={sp.especialidadeId ?? ""}
          className={selectCls}
          aria-label="Filtrar por especialidade"
        >
          <option value="">Todas as especialidades</option>
          {especialidades.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
        </select>
        <SubmitButton size="sm" pendingLabel="Filtrando…">
          Filtrar
        </SubmitButton>
        {/* legenda de cor por especialidade */}
        <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1">
          {especialidades.slice(0, 6).map((e) => (
            <span
              key={e.id}
              className="flex items-center gap-1.5 text-[11px]"
              style={{ color: "var(--text-3)" }}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: e.corDestaque }} />
              {e.nome}
            </span>
          ))}
        </div>
      </form>

      {/* No tablet (≤880px) a grade semanal de 820px fica ilegível: a área de
          toque é a Agenda do dia. Split por breakpoint canônico do kit (880px)
          via utilitário responsivo — desktop ≥881px segue idêntico ao baseline. */}
      <div className="min-[881px]:hidden">
        <EmptyState
          titulo="Grade otimizada para tela grande"
          descricao="A agenda semanal é melhor lida no computador. No tablet, use a Agenda do dia."
          cta={
            <Link href={"/medico/agenda-dia" as Route} className="btn btn-lg btn-primary">
              Abrir Agenda do dia
            </Link>
          }
        />
      </div>

      {agendaTruncada ? (
        <div
          role="alert"
          className="mb-4 rounded-md px-4 py-3 text-sm max-[880px]:hidden"
          style={{
            border: "1px solid var(--danger)",
            background: "color-mix(in srgb, var(--danger) 10%, transparent)",
            color: "var(--text)",
          }}
        >
          Esta semana tem mais horários do que a grade carrega ({MAX_SLOTS_SEMANA}); os mais tardios
          podem não aparecer. Filtre por profissional ou especialidade para ver a semana completa.
        </div>
      ) : null}

      <Card className="overflow-x-auto !p-0 max-[880px]:hidden">
        <div className="min-w-[820px]">
          {/* Cabeçalho dos dias */}
          <div
            className="grid border-b"
            style={{
              gridTemplateColumns: "56px repeat(7, 1fr)",
              borderColor: "var(--line)",
            }}
          >
            <div />
            {DIAS.map((d, i) => {
              const dt = new Date(inicio);
              dt.setDate(dt.getDate() + i);
              const isHoje = ymd(dt) === hojeYmd;
              return (
                <div
                  key={i}
                  className="px-2 py-3 text-center"
                  style={{ borderLeft: "1px solid var(--line)" }}
                >
                  <p
                    className="text-[11px] font-semibold tracking-wide uppercase"
                    style={{ color: "var(--text-3)" }}
                  >
                    {d}
                  </p>
                  <p
                    className="mx-auto mt-0.5 grid h-7 w-7 place-items-center rounded-full text-sm font-bold"
                    style={
                      isHoje
                        ? { background: "var(--accent)", color: "var(--on-accent)" }
                        : { color: "var(--text)" }
                    }
                  >
                    {dt.getDate()}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Corpo do grid */}
          <div className="grid" style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}>
            {/* coluna de horas */}
            <div className="relative" style={{ height: altura }}>
              {Array.from({ length: HORA_FIM - HORA_INICIO + 1 }, (_, i) => HORA_INICIO + i).map(
                (h) => (
                  <div
                    key={h}
                    className="absolute right-1.5 -translate-y-1/2 text-[10px] tabular-nums"
                    style={{
                      top: (h - HORA_INICIO) * 60 * PX_POR_MIN,
                      color: "var(--text-3)",
                    }}
                  >
                    {String(h).padStart(2, "0")}h
                  </div>
                ),
              )}
            </div>

            {/* 7 colunas de dia */}
            {DIAS.map((_, dia) => {
              const dtStart = new Date(inicio);
              dtStart.setDate(dtStart.getDate() + dia);
              const slotsDia = slotsPorDia.get(chaveDiaLocal(dtStart)) ?? [];
              return (
                <div
                  key={dia}
                  className="relative"
                  style={{ height: altura, borderLeft: "1px solid var(--line)" }}
                >
                  {/* linhas de hora */}
                  {Array.from(
                    { length: HORA_FIM - HORA_INICIO },
                    (_, i) => i + HORA_INICIO + 1,
                  ).map((h) => (
                    <div
                      key={h}
                      className="absolute w-full border-t"
                      style={{
                        top: (h - HORA_INICIO) * 60 * PX_POR_MIN,
                        borderColor: "var(--surface-2)",
                      }}
                    />
                  ))}
                  {/* slots */}
                  {slotsDia.map((s) => {
                    const minDia =
                      (s.dataHoraInicio.getHours() - HORA_INICIO) * 60 +
                      s.dataHoraInicio.getMinutes();
                    const top = minDia * PX_POR_MIN;
                    const height = Math.max(s.duracaoMin * PX_POR_MIN - 2, 14);
                    const cor = s.especialidade.corDestaque;
                    const isBlocked = s.status === "bloqueado";
                    const isReserved = s.status === "reservado" || s.status === "realizado";
                    const inner = s.consulta ? (
                      <a
                        href={`/medico/consultas/${s.consulta.id}`}
                        className="block h-full w-full"
                        title={`${s.consulta.cidadao.nomeCompleto} · ${s.profissional.nomeExibicao} · ${s.especialidade.nome}`}
                      >
                        <span className="block truncate font-semibold">
                          {s.consulta.cidadao.nomeCompleto}
                        </span>
                        <span className="block truncate opacity-80">
                          {s.profissional.nomeExibicao}
                        </span>
                      </a>
                    ) : s.status === "disponivel" && canMarcar ? (
                      <Link
                        href={`/medico/consultas/nova?slotId=${s.id}` as Route}
                        title={`Marcar consulta · ${s.profissional.nomeExibicao} · ${s.especialidade.nome} · ${horaCurta(s.dataHoraInicio)}`}
                        aria-label={`Marcar consulta · ${s.profissional.nomeExibicao} · ${horaCurta(s.dataHoraInicio)}`}
                        className="block h-full w-full truncate no-underline"
                      >
                        {s.profissional.nomeExibicao.split(" ").slice(0, 2).join(" ")}
                      </Link>
                    ) : (
                      <span
                        title={`${s.profissional.nomeExibicao} · ${s.especialidade.nome} · ${s.status}`}
                        className="block truncate"
                      >
                        {s.profissional.nomeExibicao.split(" ").slice(0, 2).join(" ")}
                      </span>
                    );
                    return (
                      <div
                        key={s.id}
                        className="absolute right-0.5 left-0.5 overflow-hidden rounded-[5px] px-1.5 py-0.5 text-[10px] leading-tight"
                        style={{
                          top,
                          height,
                          background: isBlocked
                            ? `repeating-linear-gradient(45deg, ${cor}1f, ${cor}1f 5px, transparent 5px, transparent 10px)`
                            : isReserved
                              ? cor
                              : cor + "26",
                          color: isReserved ? corTextoSobre(cor) : "var(--text)",
                          borderLeft: `2px solid ${cor}`,
                        }}
                      >
                        {inner}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </MedicoShell>
  );
}
