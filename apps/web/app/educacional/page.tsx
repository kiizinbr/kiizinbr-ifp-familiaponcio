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
import { Kpi, ListRow, PageHeader } from "@/components/casa";
import { useResumoEducacional, useTurmasInfantis } from "@/lib/use-educacional";
import { useConversas } from "@/lib/use-mensagens";

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
      <PageHeader
        titulo="Painel do dia"
        acoes={
          <>
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
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi
          label="Presentes agora"
          valor={`${resumo?.presentesAgora ?? 0}/${resumo?.matriculados ?? 0}`}
        />
        <Kpi label="Diários abertos" valor={resumo?.diariosAbertos ?? 0} />
        <Kpi label="Diários fechados hoje" valor={resumo?.diariosFechados ?? 0} />
        <Kpi
          label="Críticos sem leitura"
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
      <div className="mt-3">
        {turmas?.items.map((t) => (
          <Link key={t.id} href={`/educacional/turmas/${t.id}`} className="group block">
            <ListRow
              className="transition group-hover:shadow-casa-sm"
              avatar={<Baby className="h-4 w-4" />}
              titulo={<span className="group-hover:text-primary">{t.nome}</span>}
              subtitulo={`${Math.floor(t.faixaEtariaMin / 12)}–${Math.floor(t.faixaEtariaMax / 12)} anos · ${t._count.matriculas}/${t.capacidade} crianças · ${t.educador.user.nome}`}
              trailing={<ChevronRight className="h-4 w-4 text-muted-foreground" />}
            />
          </Link>
        ))}
        {turmas?.items.length === 0 && (
          <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            <BookOpenCheck className="mx-auto mb-2 h-5 w-5" />
            Nenhuma turma cadastrada ainda.
          </div>
        )}
      </div>
    </main>
  );
}
