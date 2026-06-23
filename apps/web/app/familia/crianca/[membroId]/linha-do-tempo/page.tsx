"use client";

/**
 * Linha do tempo da criança — jornada narrativa que cruza, num só fio
 * cronológico, os eventos que a família já viveu nas verticais (matrículas,
 * diários, entradas/saídas, certificados, graduações e atendimentos). Leitura
 * pura (agregada no back). Timeline vertical, mobile-first, identidade CASA.
 */
import Link from "next/link";
import {
  ArrowLeft,
  Award,
  BookOpenCheck,
  Dumbbell,
  GraduationCap,
  HeartPulse,
  LogIn,
  LogOut,
  Medal,
  Sparkles,
} from "lucide-react";

import { Alerta, Spinner } from "@/components/ui";
import { idade } from "@/lib/idade";
import {
  useTimelineCrianca,
  type EventoTimeline,
  type TipoEventoTimeline,
} from "@/lib/use-educacional";

/** Ícone por categoria de evento — leitura rápida da jornada. */
const ICONE: Record<TipoEventoTimeline, React.ReactNode> = {
  MATRICULA_CRECHE: <Sparkles className="h-4 w-4" />,
  MATRICULA_CAPACITACAO: <GraduationCap className="h-4 w-4" />,
  MATRICULA_ESPORTE: <Dumbbell className="h-4 w-4" />,
  DIARIO: <BookOpenCheck className="h-4 w-4" />,
  ENTRADA: <LogIn className="h-4 w-4" />,
  SAIDA: <LogOut className="h-4 w-4" />,
  CERTIFICADO: <Award className="h-4 w-4" />,
  GRADUACAO: <Medal className="h-4 w-4" />,
  ATENDIMENTO: <HeartPulse className="h-4 w-4" />,
};

/** Conquistas ganham destaque dourado; o resto fica no tom da unidade. */
function ehConquista(tipo: TipoEventoTimeline) {
  return tipo === "CERTIFICADO" || tipo === "GRADUACAO";
}

function dataLegivel(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function horaLegivel(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function LinhaDoTempoCriancaPage({
  params,
}: {
  params: { membroId: string };
}) {
  const { membroId } = params;
  const { data, isLoading, error } = useTimelineCrianca(membroId);

  if (isLoading) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <Spinner label="Montando a linha do tempo..." />
      </main>
    );
  }
  if (error || !data) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <Alerta tipo="erro">
          {(error as Error)?.message ?? "Linha do tempo não encontrada"}
        </Alerta>
      </main>
    );
  }

  const { crianca, eventos } = data;

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <Link
        href={`/familia/crianca/${membroId}`}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Ficha da criança
      </Link>

      <h1 className="mt-2 text-lg font-bold text-foreground">
        Linha do tempo de {crianca.nomeCompleto.split(" ")[0]}
      </h1>
      <p className="text-xs text-muted-foreground">
        {idade(crianca.dataNascimento)} anos · a jornada da sua criança no instituto
      </p>

      {eventos.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border px-6 py-10 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold text-foreground">
            A jornada está só começando.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Conforme sua criança participa, os momentos vão aparecer aqui. 💛
          </p>
        </div>
      ) : (
        <ol className="mt-6 space-y-1">
          {eventos.map((ev, i) => (
            <EventoLinha key={ev.id} evento={ev} ultimo={i === eventos.length - 1} />
          ))}
        </ol>
      )}
    </main>
  );
}

function EventoLinha({ evento, ultimo }: { evento: EventoTimeline; ultimo: boolean }) {
  const conquista = ehConquista(evento.tipo);
  return (
    <li className="relative flex gap-3 pb-5">
      {/* Trilho vertical conectando os marcos (some no último). */}
      {!ultimo && (
        <span
          aria-hidden
          className="absolute left-[15px] top-9 h-[calc(100%-1.25rem)] w-px bg-border"
        />
      )}
      <span
        className={[
          "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          conquista
            ? "bg-warning/15 text-warning ring-2 ring-warning/40"
            : "bg-primary/10 text-primary",
        ].join(" ")}
      >
        {ICONE[evento.tipo]}
      </span>

      <div
        className={[
          "min-w-0 flex-1 rounded-xl border px-4 py-3",
          conquista ? "border-warning/40 bg-warning/5" : "border-border bg-surface",
        ].join(" ")}
      >
        <p className="text-sm font-semibold text-foreground">{evento.titulo}</p>
        {evento.descricao && (
          <p className="mt-0.5 text-xs text-muted-foreground">{evento.descricao}</p>
        )}
        <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
          {dataLegivel(evento.data)} · {horaLegivel(evento.data)}
          {evento.unidade ? ` · ${evento.unidade}` : ""}
        </p>
        {evento.codigoVerificacao && (
          <p className="mt-1 text-[11px] font-medium text-primary">
            Código de verificação: {evento.codigoVerificacao}
          </p>
        )}
      </div>
    </li>
  );
}
