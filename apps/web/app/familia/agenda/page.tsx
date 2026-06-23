"use client";

/**
 * Portal da família — Agenda.
 * Calendário dos eventos das unidades das minhas crianças. Nos eventos que
 * pedem confirmação, a família responde SIM/NAO por criança (RSVP). Só vê
 * eventos das próprias unidades/turmas (o backend resolve por fichaCidadaId).
 */
import Link from "next/link";
import { CalendarDays, Check, ChevronRight, MapPin, Sun, Users, X } from "lucide-react";

import { Alerta, BotaoResposta, Spinner } from "@/components/ui";
import {
  useAgenda,
  useConfirmarEvento,
  usePresenca,
  type EventoFamilia,
  type PresencaItem,
  type RespostaPresenca,
} from "@/lib/use-familia";

function dataHoraLegivel(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AgendaFamiliaPage() {
  const { data, isLoading, isError } = useAgenda();
  // As crianças da família (nome + id) vêm da lista de presença da creche;
  // cruzamos com as confirmações do evento para o RSVP por criança.
  const { data: presenca } = usePresenca();

  if (isLoading) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <Spinner label="Carregando a agenda da sua família..." />
      </main>
    );
  }

  if (isError || !data) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <Alerta tipo="erro">
          Não foi possível carregar a agenda agora. Tente novamente em instantes.
        </Alerta>
      </main>
    );
  }

  const eventos = data.items;
  const criancas = presenca?.items ?? [];

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <header className="mb-5">
        <h1 className="text-xl font-bold text-foreground">Agenda</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Próximos eventos do Instituto. Confirme a presença quando for pedido. 📅
        </p>
      </header>

      {/* Atalho para o "vem amanhã?" da creche */}
      <Link
        href="/familia/presenca"
        className="mb-5 flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 transition hover:border-primary/50"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sun className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">Vem amanhã?</span>
          <span className="text-xs text-muted-foreground">
            Confirme a presença das crianças na creche
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>

      {eventos.length === 0 ? (
        <Alerta tipo="info">
          Nenhum evento marcado por enquanto. Assim que houver, ele aparece aqui.
        </Alerta>
      ) : (
        <ul className="space-y-4">
          {eventos.map((ev) => (
            <CartaoEvento key={ev.id} evento={ev} criancas={criancas} />
          ))}
        </ul>
      )}
    </main>
  );
}

function CartaoEvento({
  evento,
  criancas,
}: {
  evento: EventoFamilia;
  criancas: PresencaItem[];
}) {
  return (
    <li className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CalendarDays className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">{evento.titulo}</p>
          <p className="text-xs font-medium text-primary">{dataHoraLegivel(evento.inicioEm)}</p>
          {evento.descricao && (
            <p className="mt-1 text-sm text-muted-foreground">{evento.descricao}</p>
          )}
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {evento.local && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {evento.local}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {evento.turma ? evento.turma.nome : evento.unidade.nome}
            </span>
          </div>
        </div>
      </div>

      {evento.pedeConfirmacao && (
        <div className="mt-3 border-t border-border pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Confirmar presença
          </p>
          <div className="space-y-2">
            {criancas.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhuma criança elegível para confirmar.
              </p>
            ) : (
              criancas.map((c) => (
                <LinhaConfirmacao
                  key={c.crianca.id}
                  eventoId={evento.id}
                  membroId={c.crianca.id}
                  nome={c.crianca.nomeCompleto}
                  respostaAtual={
                    evento.confirmacoes.find((x) => x.membroId === c.crianca.id)?.resposta ?? null
                  }
                />
              ))
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function LinhaConfirmacao({
  eventoId,
  membroId,
  nome,
  respostaAtual,
}: {
  eventoId: string;
  membroId: string;
  nome: string;
  respostaAtual: RespostaPresenca | null;
}) {
  const confirmar = useConfirmarEvento();
  // Otimista local: usa o que voltou da mutação se já respondemos nesta tela.
  const resposta =
    (confirmar.data as { membroId?: string; resposta?: RespostaPresenca } | undefined)
      ?.membroId === membroId
      ? ((confirmar.data as { resposta: RespostaPresenca }).resposta)
      : respostaAtual;

  function responder(r: RespostaPresenca) {
    confirmar.mutate({ eventoId, membroId, resposta: r });
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="min-w-0 truncate text-sm text-foreground">{nome}</span>
      <div className="flex shrink-0 gap-1.5">
        <BotaoResposta
          ativo={resposta === "SIM"}
          tom="sim"
          onClick={() => responder("SIM")}
          disabled={confirmar.isPending}
        >
          <Check className="h-3.5 w-3.5" /> Vai
        </BotaoResposta>
        <BotaoResposta
          ativo={resposta === "NAO"}
          tom="nao"
          onClick={() => responder("NAO")}
          disabled={confirmar.isPending}
        >
          <X className="h-3.5 w-3.5" /> Não vai
        </BotaoResposta>
      </div>
    </div>
  );
}
