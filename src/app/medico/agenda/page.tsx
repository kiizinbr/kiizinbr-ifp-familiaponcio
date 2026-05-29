import { redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { db } from "@/lib/db";
import { MedicoShell, MedicoHeader } from "@/components/medico/medico-shell";
import { Card } from "@/components/ui/card";

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

export default async function AgendaSemanalPage({
  searchParams,
}: {
  searchParams: Promise<{ profissionalId?: string; especialidadeId?: string; semana?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/medico/login" as Route);
  if (!canAccessUnidade(session, "medico")) redirect("/" as Route);

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
    }),
  ]);

  const altura = (HORA_FIM - HORA_INICIO) * 60 * PX_POR_MIN;
  const hojeYmd = ymd(new Date());
  const selectCls =
    "rounded-[var(--ifp-radius-sm)] border px-2.5 py-1.5 text-sm focus:border-[rgb(var(--ifp-teal-700))] focus:outline-none";

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
              className="rounded-[var(--ifp-radius-sm)] border px-3 py-1.5 text-sm font-semibold transition hover:bg-[rgb(var(--ifp-surface-50))]"
              style={{ borderColor: "rgb(var(--ifp-surface-200))" }}
            >
              ←
            </a>
            <a
              href={`/medico/agenda?semana=${ymd(semanaProxima)}${sp.profissionalId ? `&profissionalId=${sp.profissionalId}` : ""}${sp.especialidadeId ? `&especialidadeId=${sp.especialidadeId}` : ""}`}
              className="rounded-[var(--ifp-radius-sm)] border px-3 py-1.5 text-sm font-semibold transition hover:bg-[rgb(var(--ifp-surface-50))]"
              style={{ borderColor: "rgb(var(--ifp-surface-200))" }}
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
          style={{ borderColor: "rgb(var(--ifp-surface-200))" }}
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
          style={{ borderColor: "rgb(var(--ifp-surface-200))" }}
        >
          <option value="">Todas as especialidades</option>
          {especialidades.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-[var(--ifp-radius-sm)] px-3.5 py-1.5 text-sm font-bold text-white transition hover:opacity-90"
          style={{ backgroundColor: "rgb(var(--ifp-teal-700))" }}
        >
          Filtrar
        </button>
        {/* legenda de cor por especialidade */}
        <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1">
          {especialidades.slice(0, 6).map((e) => (
            <span
              key={e.id}
              className="flex items-center gap-1.5 text-[11px]"
              style={{ color: "rgb(var(--ifp-muted))" }}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: e.corDestaque }} />
              {e.nome}
            </span>
          ))}
        </div>
      </form>

      <Card className="overflow-x-auto !p-0">
        <div className="min-w-[820px]">
          {/* Cabeçalho dos dias */}
          <div
            className="grid border-b"
            style={{
              gridTemplateColumns: "56px repeat(7, 1fr)",
              borderColor: "rgb(var(--ifp-surface-200))",
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
                  style={{ borderLeft: "1px solid rgb(var(--ifp-surface-200))" }}
                >
                  <p
                    className="text-[11px] font-semibold tracking-wide uppercase"
                    style={{ color: "rgb(var(--ifp-muted))" }}
                  >
                    {d}
                  </p>
                  <p
                    className="mx-auto mt-0.5 grid h-7 w-7 place-items-center rounded-full text-sm font-bold"
                    style={
                      isHoje
                        ? { background: "rgb(var(--ifp-teal-700))", color: "#fff" }
                        : { color: "rgb(var(--ifp-ink))" }
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
                      color: "rgb(var(--ifp-muted))",
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
              const slotsDia = slots.filter((s) => {
                const sd = s.dataHoraInicio;
                return (
                  sd.getFullYear() === dtStart.getFullYear() &&
                  sd.getMonth() === dtStart.getMonth() &&
                  sd.getDate() === dtStart.getDate()
                );
              });
              return (
                <div
                  key={dia}
                  className="relative"
                  style={{ height: altura, borderLeft: "1px solid rgb(var(--ifp-surface-200))" }}
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
                        borderColor: "rgb(var(--ifp-surface-100))",
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
                          color: isReserved ? "#fff" : "rgb(var(--ifp-ink))",
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
