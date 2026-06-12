"use client";

import Link from "next/link";
import {
  Baby,
  BellRing,
  BookOpenCheck,
  ChevronRight,
  MessagesSquare,
  Users,
} from "lucide-react";

import { Alerta, Spinner } from "@/components/ui";
import { useResumoEducacional, useTurmasInfantis } from "@/lib/use-educacional";
import { useConversas } from "@/lib/use-mensagens";

function Kpi({
  rotulo,
  valor,
  alerta,
}: {
  rotulo: string;
  valor: number | string;
  alerta?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        alerta ? "border-warning/60 bg-warning/10" : "border-border bg-surface"
      }`}
    >
      <p className="text-2xl font-bold text-foreground">{valor}</p>
      <p className="mt-1 text-xs text-muted-foreground">{rotulo}</p>
    </div>
  );
}

/** Painel da unidade: presentes × matriculados, diários, críticos sem leitura. */
export default function PainelEducacional() {
  const { data: resumo, isLoading: carregandoResumo, error } = useResumoEducacional();
  const { data: turmas, isLoading: carregandoTurmas } = useTurmasInfantis();
  const { data: conversas } = useConversas("equipe");
  const naoLidas = (conversas ?? []).reduce((soma, c) => soma + c.naoLidas, 0);

  if (carregandoResumo || carregandoTurmas) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <Spinner label="Carregando painel..." />
      </main>
    );
  }
  if (error) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <Alerta tipo="erro">{(error as Error).message}</Alerta>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Painel do dia</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/educacional/mensagens"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-primary/50"
          >
            <MessagesSquare className="h-3.5 w-3.5 text-primary" /> Mensagens
            {naoLidas > 0 ? (
              <span
                className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground"
                aria-label={`${naoLidas} ${naoLidas === 1 ? "mensagem não lida" : "mensagens não lidas"}`}
              >
                {naoLidas > 99 ? "99+" : naoLidas}
              </span>
            ) : null}
          </Link>
          <Link
            href="/educacional/comunicados"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-primary/50"
          >
            <BellRing className="h-3.5 w-3.5 text-primary" /> Comunicados
          </Link>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi
          rotulo="Presentes agora"
          valor={`${resumo?.presentesAgora ?? 0}/${resumo?.matriculados ?? 0}`}
        />
        <Kpi rotulo="Diários abertos" valor={resumo?.diariosAbertos ?? 0} />
        <Kpi rotulo="Diários fechados hoje" valor={resumo?.diariosFechados ?? 0} />
        <Kpi
          rotulo="Críticos sem leitura"
          valor={resumo?.criticosSemLeitura ?? 0}
          alerta={(resumo?.criticosSemLeitura ?? 0) > 0}
        />
      </div>

      {(resumo?.criticosSemLeitura ?? 0) > 0 && (
        <Link
          href="/educacional/comunicados"
          className="mt-4 flex items-center gap-2 rounded-lg border border-warning/60 bg-warning/10 px-4 py-3 text-sm text-foreground transition hover:border-warning"
        >
          <BellRing className="h-4 w-4 shrink-0 text-warning" />
          Há comunicado crítico sem confirmação de leitura — considere reforçar pelo
          WhatsApp oficial do IFP.
          <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
        </Link>
      )}

      <h2 className="mt-8 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <Users className="h-4 w-4" /> Turmas
      </h2>
      <ul className="mt-3 space-y-2">
        {turmas?.items.map((t) => (
          <li key={t.id}>
            <Link
              href={`/educacional/turmas/${t.id}`}
              className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 transition hover:border-primary/50"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Baby className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {Math.floor(t.faixaEtariaMin / 12)}–{Math.floor(t.faixaEtariaMax / 12)}{" "}
                    anos · {t._count.matriculas}/{t.capacidade} crianças ·{" "}
                    {t.educador.user.nome}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
        {turmas?.items.length === 0 && (
          <li className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            <BookOpenCheck className="mx-auto mb-2 h-5 w-5" />
            Nenhuma turma cadastrada ainda.
          </li>
        )}
      </ul>
    </main>
  );
}
