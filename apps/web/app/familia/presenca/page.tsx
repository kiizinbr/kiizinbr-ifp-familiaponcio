"use client";

/**
 * Portal da família — "Vem amanhã?".
 * Confirmação rápida (SIM/NAO) da presença de cada criança na creche no dia
 * seguinte. Ajuda a unidade a planejar lanche e equipe. Só as crianças da
 * própria família (o backend resolve por fichaCidadaId).
 */
import { Baby, Check, X } from "lucide-react";

import { Alerta, BotaoResposta, Spinner } from "@/components/ui";
import {
  usePresenca,
  useResponderPresenca,
  type PresencaItem,
  type RespostaPresenca,
} from "@/lib/use-familia";

function diaLegivel(iso: string) {
  // `dia` vem como AAAA-MM-DD (dia civil de SP) — monta sem fuso pra não pular.
  const [a, m, d] = iso.split("-").map((p) => Number(p));
  return new Date(a ?? 0, (m ?? 1) - 1, d ?? 1).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

export default function PresencaFamiliaPage() {
  const { data, isLoading, isError } = usePresenca();

  if (isLoading) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <Spinner label="Carregando a confirmação de amanhã..." />
      </main>
    );
  }

  if (isError || !data) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <Alerta tipo="erro">
          Não foi possível carregar a confirmação agora. Tente novamente em instantes.
        </Alerta>
      </main>
    );
  }

  const { dia, items } = data;

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <header className="mb-5">
        <h1 className="text-xl font-bold text-foreground">Vem amanhã?</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Confirme a presença de cada criança em <strong>{diaLegivel(dia)}</strong>. Isso
          ajuda a creche a se organizar. 🧡
        </p>
      </header>

      {items.length === 0 ? (
        <Alerta tipo="info">
          Nenhuma criança com matrícula ativa na creche para confirmar.
        </Alerta>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <CartaoPresenca key={item.crianca.id} item={item} />
          ))}
        </ul>
      )}
    </main>
  );
}

function CartaoPresenca({ item }: { item: PresencaItem }) {
  const responder = useResponderPresenca();
  // Reflete a resposta recém-gravada nesta tela (otimista) sobre a do servidor.
  const resposta =
    (responder.data as { membroId?: string; resposta?: RespostaPresenca } | undefined)
      ?.membroId === item.crianca.id
      ? (responder.data as { resposta: RespostaPresenca }).resposta
      : item.resposta;

  function enviar(r: RespostaPresenca) {
    responder.mutate({ membroId: item.crianca.id, resposta: r });
  }

  return (
    <li className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Baby className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-foreground">{item.crianca.nomeCompleto}</p>
          <p className="truncate text-xs text-muted-foreground">
            {item.turma.nome} · {item.unidade.nome}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {resposta === "SIM"
            ? "Confirmada"
            : resposta === "NAO"
              ? "Não vai"
              : "Aguardando resposta"}
        </span>
        <div className="flex gap-1.5">
          <BotaoResposta
            ativo={resposta === "SIM"}
            tom="sim"
            onClick={() => enviar("SIM")}
            disabled={responder.isPending}
          >
            <Check className="h-3.5 w-3.5" /> Vai
          </BotaoResposta>
          <BotaoResposta
            ativo={resposta === "NAO"}
            tom="nao"
            onClick={() => enviar("NAO")}
            disabled={responder.isPending}
          >
            <X className="h-3.5 w-3.5" /> Não vai
          </BotaoResposta>
        </div>
      </div>

      {responder.isError && (
        <p className="mt-2 text-xs text-danger">
          {responder.error instanceof Error
            ? responder.error.message
            : "Não foi possível salvar agora."}
        </p>
      )}
    </li>
  );
}
