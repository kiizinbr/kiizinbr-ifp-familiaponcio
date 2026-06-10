"use client";

/**
 * Detalhe da turma: progresso, alunos com presença%, aulas e encerramento
 * (emite certificados de quem atingiu a presença mínima do curso).
 */
import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Award,
  CalendarPlus,
  ClipboardCheck,
  Lock,
  Search,
  Stamp,
  UserPlus,
  X,
} from "lucide-react";

import {
  STATUS_MATRICULA_LABEL,
  STATUS_TURMA_LABEL,
  type ResumoEncerramentoTurma,
} from "@/lib/api";
import {
  useCriarAula,
  useEncerrarTurma,
  useFichasElegiveis,
  useMatricular,
  useTurma,
} from "@/lib/use-capacitacao";
import { Alerta, Botao, Campo, Input, Spinner } from "@/components/ui";
import { cn } from "@/lib/cn";

function dataCurta(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** Busca fichas APROVADAS na Capacitação e matricula (regra de ouro no backend). */
function MatricularAluno({ turmaId, onFechar }: { turmaId: string; onFechar: () => void }) {
  const [busca, setBusca] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const { data: resultados, isFetching } = useFichasElegiveis(busca);
  const matricular = useMatricular();

  async function adicionar(fichaId: string, nome: string) {
    setAviso(null);
    try {
      const m = await matricular.mutateAsync({ turmaId, fichaId });
      setAviso(
        m.status === "LISTA_ESPERA"
          ? `${nome} entrou na lista de espera (turma lotada).`
          : `${nome} matriculado(a)!`,
      );
      setBusca("");
    } catch (e) {
      setAviso((e as Error).message || "Falha ao matricular.");
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-primary/30 bg-surface p-4 shadow-casa-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Matricular aluno</h3>
        <button onClick={onFechar} aria-label="Fechar" className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <Campo
        label="Família elegível"
        htmlFor="busca-eleg"
        dica="Só aparecem famílias APROVADAS pelo Serviço Social para a Capacitação"
        className="mt-2"
      >
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            id="busca-eleg"
            className="pl-9"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome da família (mín. 2 letras)"
            autoFocus
          />
        </div>
      </Campo>
      {busca.trim().length >= 2 ? (
        <ul className="mt-2 divide-y divide-border rounded-md border border-border">
          {(resultados?.items ?? []).map((f) => (
            <li key={f.id}>
              <button
                type="button"
                disabled={matricular.isPending}
                onClick={() => adicionar(f.id, f.nomeCompleto)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
              >
                <span className="font-medium text-foreground">{f.nomeCompleto}</span>
                <span className="inline-flex items-center gap-1 text-xs text-primary">
                  <UserPlus className="h-3.5 w-3.5" /> matricular
                </span>
              </button>
            </li>
          ))}
          {!isFetching && (resultados?.items ?? []).length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              Nenhuma família elegível encontrada.
            </li>
          ) : null}
        </ul>
      ) : null}
      {aviso ? <div className="mt-3"><Alerta tipo={aviso.includes("Falha") || aviso.includes("não") ? "erro" : "info"}>{aviso}</Alerta></div> : null}
    </div>
  );
}

export default function TurmaDetalhePage() {
  const { turmaId } = useParams<{ turmaId: string }>();
  const router = useRouter();
  const { data: turma, isLoading, isError, error } = useTurma(turmaId);
  const criarAula = useCriarAula();
  const encerrarTurma = useEncerrarTurma();

  const [resumo, setResumo] = useState<ResumoEncerramentoTurma | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [matricularAberto, setMatricularAberto] = useState(false);

  if (isLoading) return <main className="mx-auto max-w-4xl px-6 py-8"><Spinner /></main>;
  if (isError || !turma) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-8">
        <Alerta>Não foi possível carregar a turma: {(error as Error)?.message}</Alerta>
      </main>
    );
  }

  const encerrada = turma.status === "ENCERRADA";
  const minPct = turma.curso.presencaMinimaPct;

  async function novaAula() {
    setErroAcao(null);
    try {
      const aula = await criarAula.mutateAsync({
        turmaId: turma!.id,
        dados: { data: new Date().toISOString() },
      });
      router.push(`/capacitacao/turmas/${turma!.id}/aulas/${aula.id}`);
    } catch (e) {
      setErroAcao((e as Error).message || "Falha ao criar aula.");
    }
  }

  async function encerrar() {
    setErroAcao(null);
    if (!confirm(`Encerrar a turma ${turma!.codigo}? Certificados serão emitidos para quem atingiu ${minPct}% de presença. Esta ação é definitiva.`)) return;
    try {
      setResumo(await encerrarTurma.mutateAsync(turma!.id));
    } catch (e) {
      setErroAcao((e as Error).message || "Falha ao encerrar a turma.");
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      {/* cabeçalho */}
      <div className="rounded-lg border border-border bg-surface p-5 shadow-casa-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">{turma.curso.nome}</h1>
            <p className="text-sm text-muted-foreground">
              {turma.codigo} · {turma.diasHorario}
              {turma.sala ? ` · ${turma.sala}` : ""} · Instrutor:{" "}
              {turma.instrutor.user.nome}
            </p>
          </div>
          <span
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold",
              encerrada
                ? "border-success/50 bg-success/10 text-success"
                : "border-primary/60 bg-primary/10 text-primary",
            )}
          >
            {STATUS_TURMA_LABEL[turma.status]}
          </span>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          <ClipboardCheck className="mr-1 inline h-4 w-4 text-primary" />
          {turma.aulasEncerradas} aula(s) com chamada selada · carga{" "}
          {turma.curso.cargaHorariaTotal}h · presença mínima <strong>{minPct}%</strong>
        </p>
      </div>

      {resumo ? (
        <div className="mt-4">
          <Alerta tipo="info">
            🎓 Turma encerrada: <strong>{resumo.certificadosEmitidos} certificado(s)</strong>{" "}
            emitido(s), {resumo.evadidas} evasão(ões).
          </Alerta>
        </div>
      ) : null}
      {erroAcao ? <div className="mt-4"><Alerta>{erroAcao}</Alerta></div> : null}

      {/* alunos */}
      <div className="mt-8 flex items-center justify-between">
        <h2 className="font-semibold text-foreground">Alunos ({turma.matriculas.length})</h2>
        {!encerrada && !matricularAberto ? (
          <button
            type="button"
            onClick={() => setMatricularAberto(true)}
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
          >
            <UserPlus className="h-4 w-4" /> Matricular aluno
          </button>
        ) : null}
      </div>
      {matricularAberto ? (
        <MatricularAluno turmaId={turma.id} onFechar={() => setMatricularAberto(false)} />
      ) : null}
      <ul className="mt-3 space-y-2">
        {turma.matriculas.map((m) => {
          const abaixo = m.presencaPct < minPct;
          return (
            <li
              key={m.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-foreground">
                  {m.membro?.nomeCompleto ?? m.ficha.nomeCompleto}
                </div>
                <div className="text-xs text-muted-foreground">{m.ficha.protocolo}</div>
              </div>
              <div className="w-28">
                <div className="flex items-baseline justify-between text-xs">
                  <span className={abaixo ? "font-semibold text-danger" : "font-semibold text-success"}>
                    {m.presencaPct}%
                  </span>
                  <span className="text-muted-foreground">presença</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full", abaixo ? "bg-danger" : "bg-success")}
                    style={{ width: `${Math.min(100, m.presencaPct)}%` }}
                  />
                </div>
              </div>
              <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                {STATUS_MATRICULA_LABEL[m.status]}
              </span>
              {m.certificado ? (
                <Link
                  href={`/verificar/${m.certificado.codigoVerificacao}`}
                  className="inline-flex items-center gap-1 rounded-full border border-success/50 bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success hover:underline"
                >
                  <Award className="h-3 w-3" /> Certificado
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>

      {/* aulas */}
      <h2 className="mt-8 font-semibold text-foreground">Aulas ({turma.aulas.length})</h2>
      <ul className="mt-3 space-y-2">
        {turma.aulas.map((a) => (
          <li
            key={a.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3"
          >
            <span className="w-12 text-sm font-semibold text-primary">{dataCurta(a.data)}</span>
            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
              {a.conteudo ?? "Sem conteúdo registrado"}
            </span>
            {a.encerradaEm ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" /> selada
              </span>
            ) : (
              <Link
                href={`/capacitacao/turmas/${turma.id}/aulas/${a.id}`}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Fazer chamada →
              </Link>
            )}
          </li>
        ))}
        {turma.aulas.length === 0 ? (
          <li className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            Nenhuma aula ainda.
          </li>
        ) : null}
      </ul>

      {/* ações */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/capacitacao/turmas"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Turmas
        </Link>
        {!encerrada ? (
          <div className="flex gap-2">
            <Botao variante="outline" onClick={novaAula} carregando={criarAula.isPending}>
              <CalendarPlus className="h-4 w-4" /> Nova aula (hoje)
            </Botao>
            <Botao onClick={encerrar} carregando={encerrarTurma.isPending}>
              <Stamp className="h-4 w-4" /> Encerrar turma
            </Botao>
          </div>
        ) : null}
      </div>
    </main>
  );
}
