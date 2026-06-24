"use client";

/**
 * Detalhe da turma esportiva: atletas, matrícula (regra de ouro no backend),
 * graduação pela trilha da modalidade e encerramento.
 * Molde: detalhe da turma da Capacitação (sem aulas — treinos vêm na próxima fase).
 */
import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  CalendarPlus,
  Lock,
  Medal,
  Pencil,
  Search,
  Stamp,
  Trophy,
  UserPlus,
  X,
} from "lucide-react";

import { STATUS_MATRICULA_LABEL, STATUS_TURMA_LABEL } from "@/lib/api";
import {
  useCriarTreino,
  useEditarTurmaEsportiva,
  useEncerrarTurmaEsportiva,
  useFichasElegiveisEsportivo,
  useFrequenciaAtleta,
  useGraduar,
  useMatricularEsportivo,
  useTurmaEsportiva,
  type MatriculaEsportivaItem,
  type TurmaEsportivaDetalhe,
} from "@/lib/use-esportivo";
import { Alerta, Botao, Campo, Input, Select, Spinner } from "@/components/ui";
import { cn } from "@/lib/cn";

/** Busca fichas APROVADAS no Esportivo e matricula (regra de ouro no backend). */
function MatricularAtleta({ turmaId, onFechar }: { turmaId: string; onFechar: () => void }) {
  const [busca, setBusca] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const { data: resultados, isFetching } = useFichasElegiveisEsportivo(busca);
  const matricular = useMatricularEsportivo();

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
        <h3 className="text-sm font-semibold text-foreground">Matricular atleta</h3>
        <button
          onClick={onFechar}
          aria-label="Fechar"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <Campo
        label="Família elegível"
        htmlFor="busca-eleg"
        dica="Só aparecem famílias APROVADAS pelo Serviço Social para o Esportivo"
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
      {aviso ? (
        <div className="mt-3">
          <Alerta tipo={aviso.includes("Falha") ? "erro" : "info"}>{aviso}</Alerta>
        </div>
      ) : null}
    </div>
  );
}

/** Concede o próximo nível da trilha (níveis já concedidos saem do select). */
function GraduarAtleta({
  matricula,
  trilha,
  onFechar,
}: {
  matricula: MatriculaEsportivaItem;
  trilha: string[];
  onFechar: () => void;
}) {
  const graduar = useGraduar();
  const [erro, setErro] = useState<string | null>(null);
  const concedidos = new Set(matricula.graduacoes.map((g) => g.nivel));
  const disponiveis = trilha.filter((n) => !concedidos.has(n));
  const [nivel, setNivel] = useState(disponiveis[0] ?? "");

  async function conceder() {
    setErro(null);
    try {
      await graduar.mutateAsync({ matriculaId: matricula.id, nivel });
      onFechar();
    } catch (e) {
      setErro((e as Error).message || "Falha ao graduar.");
    }
  }

  if (disponiveis.length === 0) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        Trilha completa — todos os níveis já concedidos. 🎉
      </p>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Select
        aria-label="Nível da graduação"
        className="w-auto min-w-[180px] py-1 text-xs"
        value={nivel}
        onChange={(e) => setNivel(e.target.value)}
      >
        {disponiveis.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </Select>
      <Botao className="px-2.5 py-1 text-xs" carregando={graduar.isPending} onClick={conceder}>
        Conceder
      </Botao>
      <Botao
        variante="ghost"
        className="px-2.5 py-1 text-xs"
        disabled={graduar.isPending}
        onClick={onFechar}
      >
        Cancelar
      </Botao>
      {erro ? <span className="text-xs text-danger">{erro}</span> : null}
    </div>
  );
}

/** Ficha de frequência do atleta — treinos selados + sinal de evasão (faltas seguidas). */
function FrequenciaAtleta({
  matriculaId,
  onFechar,
}: {
  matriculaId: string;
  onFechar: () => void;
}) {
  const { data, isLoading, isError } = useFrequenciaAtleta(matriculaId);

  return (
    <div className="mt-2 rounded-md border border-border bg-muted/40 p-3">
      {isLoading ? (
        <Spinner />
      ) : isError || !data ? (
        <p className="text-xs text-danger">Não foi possível carregar a frequência.</p>
      ) : data.total === 0 ? (
        <p className="text-xs text-muted-foreground">
          Sem treinos selados ainda — a frequência aparece após o primeiro treino encerrado.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="font-semibold text-foreground">
              Presença: {data.pctPresenca ?? 0}%
            </span>
            <span className="text-muted-foreground">
              {data.compareceu}/{data.total} treinos
            </span>
            <span className="text-muted-foreground">Faltas: {data.faltas}</span>
            <span className="text-muted-foreground">Atrasos: {data.atrasos}</span>
            <span className="text-muted-foreground">Justificadas: {data.justificadas}</span>
          </div>
          {data.sequenciaFaltasRecentes >= 2 ? (
            <p className="mt-2 inline-flex items-center gap-1 rounded-full border border-danger/40 bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">
              ⚠ {data.sequenciaFaltasRecentes} faltas seguidas — risco de evasão
            </p>
          ) : null}
          <ul className="mt-2 space-y-1">
            {data.historico.slice(0, 6).map((h, i) => (
              <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="w-12 font-medium text-foreground">
                  {new Date(h.data).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                  })}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-medium",
                    h.status === "PRESENTE" && "bg-success/10 text-success",
                    h.status === "ATRASADO" && "bg-primary/10 text-primary",
                    h.status === "FALTA" && "bg-danger/10 text-danger",
                    h.status === "JUSTIFICADA" && "bg-muted text-foreground",
                  )}
                >
                  {h.status}
                </span>
                <span className="truncate">{h.conteudo ?? "—"}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onFechar}
            className="mt-2 text-xs text-muted-foreground hover:text-foreground"
          >
            Fechar
          </button>
        </>
      )}
    </div>
  );
}

/** Form de correção dos dados operacionais da turma (não muda modalidade/código). */
function EditarTurma({
  turma,
  onFechar,
}: {
  turma: TurmaEsportivaDetalhe;
  onFechar: () => void;
}) {
  const editar = useEditarTurmaEsportiva();
  const [diasHorario, setDiasHorario] = useState(turma.diasHorario);
  const [local, setLocal] = useState(turma.local ?? "");
  const [vagas, setVagas] = useState(String(turma.vagasTotais));
  const [faixaMin, setFaixaMin] = useState(turma.faixaEtariaMin?.toString() ?? "");
  const [faixaMax, setFaixaMax] = useState(turma.faixaEtariaMax?.toString() ?? "");
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setErro(null);
    try {
      await editar.mutateAsync({
        turmaId: turma.id,
        diasHorario: diasHorario.trim(),
        local: local.trim() || undefined,
        vagasTotais: Number(vagas),
        faixaEtariaMin: faixaMin !== "" ? Number(faixaMin) : undefined,
        faixaEtariaMax: faixaMax !== "" ? Number(faixaMax) : undefined,
      });
      onFechar();
    } catch (e) {
      setErro((e as Error).message || "Falha ao salvar.");
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-primary/30 bg-surface p-4 shadow-casa-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Corrigir dados da turma</h3>
        <button
          onClick={onFechar}
          aria-label="Fechar"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <Campo label="Dias e horário" htmlFor="ed-dias">
          <Input id="ed-dias" value={diasHorario} onChange={(e) => setDiasHorario(e.target.value)} />
        </Campo>
        <Campo label="Local" htmlFor="ed-local">
          <Input
            id="ed-local"
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            placeholder="Opcional"
          />
        </Campo>
        <Campo label="Vagas" htmlFor="ed-vagas">
          <Input
            id="ed-vagas"
            type="number"
            min={1}
            value={vagas}
            onChange={(e) => setVagas(e.target.value)}
          />
        </Campo>
        <div className="grid grid-cols-2 gap-2">
          <Campo label="Idade mín." htmlFor="ed-min">
            <Input
              id="ed-min"
              type="number"
              min={0}
              value={faixaMin}
              onChange={(e) => setFaixaMin(e.target.value)}
              placeholder="—"
            />
          </Campo>
          <Campo label="Idade máx." htmlFor="ed-max">
            <Input
              id="ed-max"
              type="number"
              min={0}
              value={faixaMax}
              onChange={(e) => setFaixaMax(e.target.value)}
              placeholder="—"
            />
          </Campo>
        </div>
      </div>
      {erro ? (
        <div className="mt-2">
          <Alerta tipo="erro">{erro}</Alerta>
        </div>
      ) : null}
      <div className="mt-3 flex gap-2">
        <Botao carregando={editar.isPending} onClick={salvar}>
          Salvar
        </Botao>
        <Botao variante="ghost" disabled={editar.isPending} onClick={onFechar}>
          Cancelar
        </Botao>
      </div>
    </div>
  );
}

export default function TurmaEsportivaDetalhePage() {
  const { turmaId } = useParams<{ turmaId: string }>();
  const router = useRouter();
  const { data: turma, isLoading, isError, error } = useTurmaEsportiva(turmaId);
  const encerrarTurma = useEncerrarTurmaEsportiva();
  const criarTreino = useCriarTreino();

  const [matricularAberto, setMatricularAberto] = useState(false);
  const [graduandoId, setGraduandoId] = useState<string | null>(null);
  const [frequenciaId, setFrequenciaId] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [resumoEncerramento, setResumoEncerramento] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  if (isLoading) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-8">
        <Spinner />
      </main>
    );
  }
  if (isError || !turma) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-8">
        <Alerta tipo="erro">
          Não foi possível carregar a turma: {(error as Error)?.message}
        </Alerta>
      </main>
    );
  }

  const encerrada = turma.status === "ENCERRADA";
  const trilha = turma.modalidade.trilhaGraduacoes;

  async function novoTreino() {
    setErroAcao(null);
    try {
      const treino = await criarTreino.mutateAsync({
        turmaId: turma!.id,
        data: new Date().toISOString(),
      });
      router.push(`/esportivo/turmas/${turma!.id}/treinos/${treino.id}`);
    } catch (e) {
      setErroAcao((e as Error).message || "Falha ao registrar treino.");
    }
  }

  async function encerrar() {
    setErroAcao(null);
    if (
      !confirm(
        `Encerrar a turma ${turma!.codigo}? Atletas ativos serão concluídos e a lista de espera, cancelada. Esta ação é definitiva.`,
      )
    )
      return;
    try {
      const r = await encerrarTurma.mutateAsync(turma!.id);
      setResumoEncerramento(
        `Turma encerrada: ${r.concluidas} atleta(s) concluíram, ${r.esperaCanceladas} na espera cancelado(s).`,
      );
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
            <h1 className="text-xl font-bold text-foreground">
              {turma.modalidade.nome} · {turma.codigo}
            </h1>
            <p className="text-sm text-muted-foreground">
              {turma.diasHorario}
              {turma.local ? ` · ${turma.local}` : ""} · Instrutor:{" "}
              {turma.instrutor.user.nome}
              {turma.faixaEtariaMin != null && turma.faixaEtariaMax != null
                ? ` · ${turma.faixaEtariaMin}–${turma.faixaEtariaMax} anos`
                : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
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
            {!encerrada ? (
              <button
                type="button"
                onClick={() => setEditando((v) => !v)}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:text-primary"
              >
                <Pencil className="h-3.5 w-3.5" /> Editar
              </button>
            ) : null}
          </div>
        </div>
        {trilha.length > 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            <Trophy className="mr-1 inline h-4 w-4 text-primary" />
            Trilha de graduações: {trilha.join(" → ")}
          </p>
        ) : null}
      </div>

      {editando ? <EditarTurma turma={turma} onFechar={() => setEditando(false)} /> : null}

      {resumoEncerramento ? (
        <div className="mt-4">
          <Alerta tipo="info">{resumoEncerramento}</Alerta>
        </div>
      ) : null}
      {erroAcao ? (
        <div className="mt-4">
          <Alerta tipo="erro">{erroAcao}</Alerta>
        </div>
      ) : null}

      {/* atletas */}
      <div className="mt-8 flex items-center justify-between">
        <h2 className="font-semibold text-foreground">
          Atletas ({turma.matriculas.length}/{turma.vagasTotais} vagas)
        </h2>
        {!encerrada && !matricularAberto ? (
          <button
            type="button"
            onClick={() => setMatricularAberto(true)}
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
          >
            <UserPlus className="h-4 w-4" /> Matricular atleta
          </button>
        ) : null}
      </div>
      {matricularAberto ? (
        <MatricularAtleta turmaId={turma.id} onFechar={() => setMatricularAberto(false)} />
      ) : null}

      <ul className="mt-3 space-y-2">
        {turma.matriculas.map((m) => {
          const podeGraduar =
            trilha.length > 0 &&
            (m.status === "ATIVA" || m.status === "CONCLUIDA");
          return (
            <li key={m.id} className="rounded-lg border border-border bg-surface p-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-foreground">
                    {m.membro?.nomeCompleto ?? m.ficha.nomeCompleto}
                  </div>
                  <div className="text-xs text-muted-foreground">{m.ficha.protocolo}</div>
                </div>
                <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  {STATUS_MATRICULA_LABEL[m.status as keyof typeof STATUS_MATRICULA_LABEL] ??
                    m.status}
                  {m.posicaoEspera ? ` #${m.posicaoEspera}` : ""}
                </span>
                {podeGraduar && graduandoId !== m.id ? (
                  <button
                    type="button"
                    onClick={() => setGraduandoId(m.id)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    <Medal className="h-3.5 w-3.5" /> Graduar
                  </button>
                ) : null}
                {frequenciaId !== m.id ? (
                  <button
                    type="button"
                    onClick={() => setFrequenciaId(m.id)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary"
                  >
                    <Activity className="h-3.5 w-3.5" /> Frequência
                  </button>
                ) : null}
              </div>

              {m.graduacoes.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.graduacoes.map((g) => (
                    <Link
                      key={g.id}
                      href={`/verificar-graduacao/${g.codigoVerificacao}`}
                      className="inline-flex items-center gap-1 rounded-full border border-success/50 bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success hover:underline"
                      title={`Concedida em ${new Date(g.concedidaEm).toLocaleDateString("pt-BR")}`}
                    >
                      <Trophy className="h-3 w-3" /> {g.nivel}
                    </Link>
                  ))}
                </div>
              ) : null}

              {graduandoId === m.id ? (
                <GraduarAtleta
                  matricula={m}
                  trilha={trilha}
                  onFechar={() => setGraduandoId(null)}
                />
              ) : null}

              {frequenciaId === m.id ? (
                <FrequenciaAtleta matriculaId={m.id} onFechar={() => setFrequenciaId(null)} />
              ) : null}
            </li>
          );
        })}
        {turma.matriculas.length === 0 ? (
          <li className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            Nenhum atleta ainda.
          </li>
        ) : null}
      </ul>

      {/* treinos */}
      <h2 className="mt-8 font-semibold text-foreground">Treinos ({turma.treinos.length})</h2>
      <ul className="mt-3 space-y-2">
        {turma.treinos.map((t) => (
          <li
            key={t.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3"
          >
            <span className="w-12 text-sm font-semibold text-primary">
              {new Date(t.data).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
              })}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
              {t.conteudo ?? "Sem conteúdo registrado"}
            </span>
            {t.encerradoEm ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" /> selado
              </span>
            ) : (
              <Link
                href={`/esportivo/turmas/${turma.id}/treinos/${t.id}`}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Fazer chamada →
              </Link>
            )}
          </li>
        ))}
        {turma.treinos.length === 0 ? (
          <li className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            Nenhum treino ainda.
          </li>
        ) : null}
      </ul>

      {/* ações */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/esportivo"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Painel
        </Link>
        {!encerrada ? (
          <div className="flex gap-2">
            <Botao variante="outline" onClick={novoTreino} carregando={criarTreino.isPending}>
              <CalendarPlus className="h-4 w-4" /> Novo treino (hoje)
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
