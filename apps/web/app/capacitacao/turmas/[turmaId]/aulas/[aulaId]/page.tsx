"use client";

/**
 * Chamada da aula — MOBILE-FIRST (celular do instrutor, padrão da pesquisa
 * de referências): alvos de toque grandes, um aluno por linha, P/F/J.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Lock, Save, Stamp } from "lucide-react";

import { STATUS_PRESENCA_LABEL, type StatusPresenca } from "@/lib/api";
import { useAula, useEncerrarAula, useLancarChamada, useTurma } from "@/lib/use-capacitacao";
import { Alerta, Botao, Spinner } from "@/components/ui";
import { cn } from "@/lib/cn";

const OPCOES: { valor: StatusPresenca; rotulo: string; ativo: string }[] = [
  { valor: "PRESENTE", rotulo: "P", ativo: "bg-success text-ifp-white border-success" },
  { valor: "FALTA", rotulo: "F", ativo: "bg-danger text-ifp-white border-danger" },
  { valor: "JUSTIFICADA", rotulo: "J", ativo: "bg-warning text-ifp-white border-warning" },
];

export default function ChamadaPage() {
  const { turmaId, aulaId } = useParams<{ turmaId: string; aulaId: string }>();
  const router = useRouter();
  const { data: turma, isLoading, isError, error } = useTurma(turmaId);
  const lancar = useLancarChamada();
  const encerrarAula = useEncerrarAula();

  const [marcacao, setMarcacao] = useState<Record<string, StatusPresenca>>({});
  const [aviso, setAviso] = useState<string | null>(null);

  // Hidrata com o que já foi salvo (volta na chamada sem perder lançamentos)
  const { data: aulaSalva } = useAula(aulaId);
  const hidratada = useRef(false);
  useEffect(() => {
    if (!aulaSalva || hidratada.current) return;
    hidratada.current = true;
    if (aulaSalva.presencas.length > 0) {
      const m: Record<string, StatusPresenca> = {};
      for (const p of aulaSalva.presencas) m[p.matriculaId] = p.status;
      setMarcacao(m);
    }
  }, [aulaSalva]);

  if (isLoading) return <main className="mx-auto max-w-lg px-4 py-8"><Spinner /></main>;
  if (isError || !turma) {
    return (
      <main className="mx-auto max-w-lg px-4 py-8">
        <Alerta>Não foi possível carregar: {(error as Error)?.message}</Alerta>
      </main>
    );
  }

  const aula = turma.aulas.find((a) => a.id === aulaId);
  if (!aula) {
    return (
      <main className="mx-auto max-w-lg px-4 py-8">
        <Alerta>Aula não encontrada nesta turma.</Alerta>
      </main>
    );
  }
  const selada = !!aula.encerradaEm;
  const alunos = turma.matriculas.filter((m) => m.status === "ATIVA" || m.status === "CONCLUIDA");

  const statusDe = (matriculaId: string): StatusPresenca =>
    marcacao[matriculaId] ?? "PRESENTE";

  function itens() {
    return alunos.map((m) => ({ matriculaId: m.id, status: statusDe(m.id) }));
  }

  async function salvar(selarDepois: boolean) {
    setAviso(null);
    try {
      await lancar.mutateAsync({ aulaId: aula!.id, itens: itens() });
      if (selarDepois) {
        await encerrarAula.mutateAsync(aula!.id);
        router.push(`/capacitacao/turmas/${turmaId}`);
        return;
      }
      setAviso("Chamada salva.");
    } catch (e) {
      setAviso((e as Error).message || "Falha ao salvar chamada.");
    }
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <h1 className="text-lg font-bold text-foreground">Chamada — {turma.codigo}</h1>
      <p className="text-sm text-muted-foreground">
        {new Date(aula.data).toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "2-digit",
          month: "long",
        })}
        {aula.conteudo ? ` · ${aula.conteudo}` : ""}
      </p>

      {selada ? (
        <div className="mt-4">
          <Alerta tipo="info">
            <span className="inline-flex items-center gap-2">
              <Lock className="h-4 w-4" /> Aula selada — a chamada é imutável.
            </span>
          </Alerta>
        </div>
      ) : null}
      {aviso ? <div className="mt-4"><Alerta tipo={aviso === "Chamada salva." ? "info" : "erro"}>{aviso}</Alerta></div> : null}

      <ul className="mt-5 space-y-2">
        {alunos.map((m) => {
          const atual = statusDe(m.id);
          return (
            <li
              key={m.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-foreground">
                  {m.membro?.nomeCompleto ?? m.ficha.nomeCompleto}
                </div>
                <div className="text-xs text-muted-foreground">
                  {STATUS_PRESENCA_LABEL[atual]}
                </div>
              </div>
              <div className="flex gap-1.5" role="radiogroup" aria-label={`Presença de ${m.ficha.nomeCompleto}`}>
                {OPCOES.map((op) => (
                  <button
                    key={op.valor}
                    type="button"
                    role="radio"
                    aria-checked={atual === op.valor}
                    disabled={selada}
                    onClick={() => setMarcacao((s) => ({ ...s, [m.id]: op.valor }))}
                    className={cn(
                      "h-11 w-11 rounded-full border text-sm font-bold transition disabled:opacity-50",
                      atual === op.valor
                        ? op.ativo
                        : "border-border bg-muted text-muted-foreground",
                    )}
                  >
                    {op.rotulo}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex items-center justify-between gap-2">
        <Link
          href={`/capacitacao/turmas/${turmaId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Turma
        </Link>
        {!selada ? (
          <div className="flex gap-2">
            <Botao variante="outline" onClick={() => salvar(false)} carregando={lancar.isPending}>
              <Save className="h-4 w-4" /> Salvar
            </Botao>
            <Botao onClick={() => salvar(true)} carregando={encerrarAula.isPending}>
              <Stamp className="h-4 w-4" /> Salvar e selar
            </Botao>
          </div>
        ) : null}
      </div>
    </main>
  );
}
