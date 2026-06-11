"use client";

/**
 * Chamada do treino — MOBILE-FIRST (celular do instrutor no tatame/quadra):
 * alvos de toque grandes, um atleta por linha, P/F/J. Molde da chamada de aula.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Lock, Save, Stamp } from "lucide-react";

import { STATUS_PRESENCA_LABEL, type StatusPresenca } from "@/lib/api";
import {
  useEncerrarTreino,
  useLancarChamadaTreino,
  useTreino,
  useTurmaEsportiva,
} from "@/lib/use-esportivo";
import { Alerta, Botao, Spinner } from "@/components/ui";
import { cn } from "@/lib/cn";

const OPCOES: { valor: StatusPresenca; rotulo: string; ativo: string }[] = [
  { valor: "PRESENTE", rotulo: "P", ativo: "bg-success text-ifp-white border-success" },
  { valor: "FALTA", rotulo: "F", ativo: "bg-danger text-ifp-white border-danger" },
  { valor: "JUSTIFICADA", rotulo: "J", ativo: "bg-warning text-ifp-white border-warning" },
];

export default function ChamadaTreinoPage() {
  const { turmaId, treinoId } = useParams<{ turmaId: string; treinoId: string }>();
  const router = useRouter();
  const { data: turma, isLoading, isError, error } = useTurmaEsportiva(turmaId);
  const lancar = useLancarChamadaTreino();
  const encerrarTreino = useEncerrarTreino();

  const [marcacao, setMarcacao] = useState<Record<string, StatusPresenca>>({});
  const [aviso, setAviso] = useState<string | null>(null);

  // Hidrata com o que já foi salvo (volta na chamada sem perder lançamentos)
  const { data: treinoSalvo } = useTreino(treinoId);
  const hidratada = useRef(false);
  useEffect(() => {
    if (!treinoSalvo || hidratada.current) return;
    hidratada.current = true;
    if (treinoSalvo.presencas.length > 0) {
      const m: Record<string, StatusPresenca> = {};
      for (const p of treinoSalvo.presencas) m[p.matriculaId] = p.status;
      setMarcacao(m);
    }
  }, [treinoSalvo]);

  if (isLoading) {
    return (
      <main className="mx-auto max-w-lg px-4 py-8">
        <Spinner />
      </main>
    );
  }
  if (isError || !turma) {
    return (
      <main className="mx-auto max-w-lg px-4 py-8">
        <Alerta tipo="erro">Não foi possível carregar: {(error as Error)?.message}</Alerta>
      </main>
    );
  }

  const treino = turma.treinos.find((t) => t.id === treinoId);
  if (!treino) {
    return (
      <main className="mx-auto max-w-lg px-4 py-8">
        <Alerta tipo="erro">Treino não encontrado nesta turma.</Alerta>
      </main>
    );
  }
  const selado = !!treino.encerradoEm;
  const atletas = turma.matriculas.filter(
    (m) => m.status === "ATIVA" || m.status === "CONCLUIDA",
  );

  const statusDe = (matriculaId: string): StatusPresenca =>
    marcacao[matriculaId] ?? "PRESENTE";

  function itens() {
    return atletas.map((m) => ({ matriculaId: m.id, status: statusDe(m.id) }));
  }

  async function salvar(selarDepois: boolean) {
    setAviso(null);
    try {
      await lancar.mutateAsync({ treinoId: treino!.id, itens: itens() });
      if (selarDepois) {
        await encerrarTreino.mutateAsync(treino!.id);
        router.push(`/esportivo/turmas/${turmaId}`);
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
        {new Date(treino.data).toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "2-digit",
          month: "long",
        })}
        {treino.conteudo ? ` · ${treino.conteudo}` : ""}
      </p>

      {selado ? (
        <div className="mt-4">
          <Alerta tipo="info">
            <span className="inline-flex items-center gap-2">
              <Lock className="h-4 w-4" /> Treino selado — a chamada é imutável.
            </span>
          </Alerta>
        </div>
      ) : null}
      {aviso ? (
        <div className="mt-4">
          <Alerta tipo={aviso === "Chamada salva." ? "info" : "erro"}>{aviso}</Alerta>
        </div>
      ) : null}

      <ul className="mt-5 space-y-2">
        {atletas.map((m) => {
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
              <div
                className="flex gap-1.5"
                role="radiogroup"
                aria-label={`Presença de ${m.ficha.nomeCompleto}`}
              >
                {OPCOES.map((op) => (
                  <button
                    key={op.valor}
                    type="button"
                    role="radio"
                    aria-checked={atual === op.valor}
                    disabled={selado}
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
          href={`/esportivo/turmas/${turmaId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Turma
        </Link>
        {!selado ? (
          <div className="flex gap-2">
            <Botao variante="outline" onClick={() => salvar(false)} carregando={lancar.isPending}>
              <Save className="h-4 w-4" /> Salvar
            </Botao>
            <Botao onClick={() => salvar(true)} carregando={encerrarTreino.isPending}>
              <Stamp className="h-4 w-4" /> Salvar e selar
            </Botao>
          </div>
        ) : null}
      </div>
    </main>
  );
}
