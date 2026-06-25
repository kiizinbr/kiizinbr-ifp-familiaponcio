"use client";

/**
 * Tela 1 do portal: o diário do dia (só FECHADO — Brightwheel privado).
 * Linguagem simples, ícones grandes, navegação por dia.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Lock, Moon, Apple, Paintbrush, Droplets, AlertCircle, MessagesSquare } from "lucide-react";

import { Image as ImageIcon } from "lucide-react";

import { Alerta, Spinner } from "@/components/ui";
import {
  TIPO_ROTINA_LABEL,
  useBaixarFotoFamilia,
  useDiarioFamilia,
  useFotosDiarioFamilia,
  useMinhasCriancas,
  type TipoRegistroRotina,
} from "@/lib/use-educacional";
import { useConversas } from "@/lib/use-mensagens";

const ICONE_TIPO: Record<TipoRegistroRotina, React.ReactNode> = {
  ALIMENTACAO: <Apple className="h-5 w-5" />,
  SONO: <Moon className="h-5 w-5" />,
  HIGIENE: <Droplets className="h-5 w-5" />,
  ATIVIDADE: <Paintbrush className="h-5 w-5" />,
  OCORRENCIA: <AlertCircle className="h-5 w-5" />,
};

function diaISO(offsetDias: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDias);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
}

export default function DiarioFamiliaPage() {
  const { data: criancas, isLoading: carregandoCriancas } = useMinhasCriancas();
  const [membroId, setMembroId] = useState<string | null>(null);
  const [offset, setOffset] = useState(0); // 0 = hoje, -1 = ontem...

  const selecionado = useMemo(() => {
    const itens = criancas?.items ?? [];
    return membroId ?? itens[0]?.crianca.id ?? null;
  }, [criancas, membroId]);

  const data = diaISO(offset);
  const { data: diario, isLoading } = useDiarioFamilia(selecionado ?? undefined, data);
  const { data: fotos } = useFotosDiarioFamilia(selecionado ?? undefined, data);
  const baixarFoto = useBaixarFotoFamilia();
  const { data: conversas } = useConversas("familia");
  const mensagensNaoLidas = (conversas ?? []).reduce((soma, c) => soma + c.naoLidas, 0);

  if (carregandoCriancas) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <Spinner label="Carregando..." />
      </main>
    );
  }

  const itens = criancas?.items ?? [];
  if (itens.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <Alerta tipo="info">
          Nenhuma criança matriculada encontrada para a sua família.
        </Alerta>
      </main>
    );
  }

  const dataLegivel = new Date(`${data}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      {itens.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {itens.map((m) => (
            <button
              key={m.crianca.id}
              type="button"
              onClick={() => setMembroId(m.crianca.id)}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                selecionado === m.crianca.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-surface text-muted-foreground"
              }`}
            >
              {m.crianca.nomeCompleto.split(" ")[0]}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOffset((o) => o - 1)}
          className="rounded-full border border-border p-2 text-muted-foreground hover:text-primary"
          aria-label="Dia anterior"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="text-sm font-semibold capitalize text-foreground">{dataLegivel}</p>
        <button
          type="button"
          onClick={() => setOffset((o) => Math.min(0, o + 1))}
          disabled={offset === 0}
          className="rounded-full border border-border p-2 text-muted-foreground hover:text-primary disabled:opacity-40"
          aria-label="Próximo dia"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {isLoading ? (
        <Spinner label="Abrindo o diário..." />
      ) : !diario?.diario ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border px-6 py-10 text-center">
          <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold text-foreground">
            O diário deste dia ainda não foi fechado.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            A educadora fecha o diário no fim do dia — volte mais tarde. 💛
          </p>
        </div>
      ) : (
        <div className="mt-5">
          {diario.checks.length > 0 && (
            <div className="rounded-xl border border-border bg-surface px-4 py-3 text-xs text-muted-foreground">
              {diario.checks.map((c) => (
                <p key={c.id}>
                  {c.sentido === "ENTRADA" ? "🌅 Chegou" : "🏠 Saiu"} às{" "}
                  {new Date(c.ocorridoEm).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  com {c.autorizado.nome} ({c.autorizado.parentesco})
                </p>
              ))}
            </div>
          )}

          <ul className="mt-4 space-y-3">
            {diario.diario.registros.map((r) => (
              <li
                key={r.id}
                className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4"
              >
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {ICONE_TIPO[r.tipo]}
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                    {TIPO_ROTINA_LABEL[r.tipo]} ·{" "}
                    {new Date(r.ocorridoEm).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <p className="mt-0.5 text-sm text-foreground">{r.descricao}</p>
                </div>
              </li>
            ))}
          </ul>

          {/* Fotos afetivas do dia (C3) — só do diário fechado, da própria criança. */}
          {(fotos?.items?.length ?? 0) > 0 && (
            <div className="mt-5">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                <ImageIcon className="h-4 w-4" /> Fotos do dia
              </p>
              <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {fotos?.items.map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => baixarFoto.mutate(f.id)}
                      className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-3 text-left transition hover:border-primary/50"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <ImageIcon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground">
                          {f.legenda || "Foto do dia"}
                        </span>
                        <span className="text-xs text-muted-foreground">Toque para abrir 💛</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Entrada para o canal oficial de mensagens com a equipe */}
      <Link
        href="/familia/mensagens"
        className="mt-6 flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 transition hover:border-primary/50"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MessagesSquare className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">Mensagens</span>
          <span className="text-xs text-muted-foreground">
            {mensagensNaoLidas > 0
              ? `${mensagensNaoLidas} ${mensagensNaoLidas === 1 ? "mensagem nova" : "mensagens novas"} da equipe`
              : "Fale com a equipe do instituto"}
          </span>
        </span>
        {mensagensNaoLidas > 0 ? (
          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
            {mensagensNaoLidas > 99 ? "99+" : mensagensNaoLidas}
          </span>
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </Link>
    </main>
  );
}
