"use client";

import Link from "next/link";
import {
  Baby,
  BellRing,
  BookOpenCheck,
  ChevronRight,
  Megaphone,
  Users,
} from "lucide-react";

import { Alerta, Spinner } from "@/components/ui";
import { Card, Kpi, ListRow, PageHeader, SecTitle } from "@/components/casa";
import { useResumoEducacional, useTurmasInfantis } from "@/lib/use-educacional";

/** Painel da unidade: presentes × matriculados, diários, críticos sem leitura. */
export default function PainelEducacional() {
  const { data: resumo, isLoading: carregandoResumo, error } = useResumoEducacional();
  const { data: turmas, isLoading: carregandoTurmas } = useTurmasInfantis();

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
          <Link
            href="/educacional/comunicados"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-foreground hover:bg-muted"
          >
            <Megaphone className="h-4 w-4" /> Comunicados
          </Link>
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
        <Card className="mt-4 flex items-center gap-2 border-warning/60 bg-warning/10 p-4 text-sm text-foreground">
          <BellRing className="h-4 w-4 shrink-0 text-warning" />
          Há comunicado crítico sem confirmação de leitura — considere reforçar pelo
          WhatsApp oficial do IFP.
        </Card>
      )}

      <div className="mt-8">
        <SecTitle icon={<Users />}>Turmas</SecTitle>
        <ul>
          {turmas?.items.map((t) => (
            <li key={t.id}>
              <Link href={`/educacional/turmas/${t.id}`} className="block">
                <ListRow
                  className="transition hover:border-primary/50"
                  avatar={<Baby className="h-4 w-4" />}
                  titulo={<span className="text-sm">{t.nome}</span>}
                  subtitulo={
                    <>
                      {Math.floor(t.faixaEtariaMin / 12)}–{Math.floor(t.faixaEtariaMax / 12)}{" "}
                      anos · {t._count.matriculas}/{t.capacidade} crianças ·{" "}
                      {t.educador.user.nome}
                    </>
                  }
                  trailing={<ChevronRight className="h-4 w-4 text-muted-foreground" />}
                />
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
      </div>
    </main>
  );
}
