"use client";

/**
 * Detalhe da turma: alunos com presença%, aulas e encerramento (emite
 * certificados de quem atingiu a presença mínima). Permite matricular titular
 * ou dependente, trancar/cancelar/reativar matrícula e abrir aula com data e
 * conteúdo.
 */
import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Award,
  Ban,
  CalendarPlus,
  ClipboardCheck,
  Lock,
  Pencil,
  RotateCcw,
  Search,
  Stamp,
  UserPlus,
  X,
} from "lucide-react";

import {
  ApiError,
  STATUS_MATRICULA_LABEL,
  STATUS_TURMA_LABEL,
  type ResumoEncerramentoTurma,
  type TurmaDetalhe,
} from "@/lib/api";
import {
  useAlterarMatricula,
  useCriarAula,
  useEditarTurma,
  useEncerrarTurma,
  useFichasElegiveis,
  useMatricular,
  useTurma,
  type AcaoMatricula,
} from "@/lib/use-capacitacao";
import { Alerta, Botao, Campo, Input, Spinner } from "@/components/ui";
import { cn } from "@/lib/cn";

function dataCurta(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** Busca fichas APROVADAS e matricula o titular OU um dependente da família. */
function MatricularAluno({ turmaId, onFechar }: { turmaId: string; onFechar: () => void }) {
  const [busca, setBusca] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [expandida, setExpandida] = useState<string | null>(null);
  const { data: resultados, isFetching } = useFichasElegiveis(busca);
  const matricular = useMatricular();

  async function adicionar(
    fichaId: string,
    membroId: string | undefined,
    nome: string,
    consentimentoTitular?: boolean,
  ) {
    setAviso(null);
    try {
      const m = await matricular.mutateAsync({ turmaId, fichaId, membroId, consentimentoTitular });
      setAviso(
        m.status === "LISTA_ESPERA"
          ? `${nome} entrou na lista de espera (turma lotada).`
          : `${nome} matriculado(a)!`,
      );
      setBusca("");
      setExpandida(null);
    } catch (e) {
      // Menor de 18: o servidor exige o consentimento do responsável (LGPD).
      if (
        e instanceof ApiError &&
        e.status === 400 &&
        (e.body as { code?: string })?.code === "CONSENTIMENTO_NECESSARIO" &&
        !consentimentoTitular
      ) {
        const ok = window.confirm(
          `${nome} é menor de 18 anos. O responsável (titular) autoriza esta matrícula? ` +
            `O consentimento ficará registrado (LGPD).`,
        );
        if (ok) {
          await adicionar(fichaId, membroId, nome, true);
          return;
        }
        setAviso("Matrícula de menor cancelada — falta o consentimento do responsável.");
        return;
      }
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
            <li key={f.id} className="px-3 py-2">
              <button
                type="button"
                onClick={() => setExpandida((id) => (id === f.id ? null : f.id))}
                className="flex w-full items-center justify-between text-left text-sm"
              >
                <span className="font-medium text-foreground">{f.nomeCompleto}</span>
                <span className="text-xs text-primary">
                  {expandida === f.id ? "fechar" : "matricular →"}
                </span>
              </button>
              {expandida === f.id ? (
                <div className="mt-2 space-y-1.5 border-t border-border pt-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Quem vai cursar?
                  </p>
                  <button
                    type="button"
                    disabled={matricular.isPending}
                    onClick={() => adicionar(f.id, undefined, f.nomeCompleto)}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-50"
                  >
                    <span>{f.nomeCompleto} <span className="text-xs text-muted-foreground">(titular)</span></span>
                    <UserPlus className="h-3.5 w-3.5 text-primary" />
                  </button>
                  {f.membros.map((mb) => (
                    <button
                      key={mb.id}
                      type="button"
                      disabled={matricular.isPending}
                      onClick={() => adicionar(f.id, mb.id, mb.nomeCompleto)}
                      className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-50"
                    >
                      <span>
                        {mb.nomeCompleto}{" "}
                        <span className="text-xs text-muted-foreground">({mb.parentesco.toLowerCase()})</span>
                      </span>
                      <UserPlus className="h-3.5 w-3.5 text-primary" />
                    </button>
                  ))}
                </div>
              ) : null}
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
          <Alerta tipo={aviso.includes("Falha") || aviso.includes("não") ? "erro" : "info"}>{aviso}</Alerta>
        </div>
      ) : null}
    </div>
  );
}

/** Ações de trancar/cancelar/reativar de uma matrícula (turma em andamento). */
function AcoesMatricula({ matriculaId, status }: { matriculaId: string; status: string }) {
  const alterar = useAlterarMatricula();
  const [erro, setErro] = useState<string | null>(null);

  async function aplicar(novo: AcaoMatricula, confirmar?: string) {
    if (confirmar && !confirm(confirmar)) return;
    setErro(null);
    try {
      await alterar.mutateAsync({ matriculaId, status: novo });
    } catch (e) {
      setErro((e as Error).message || "Falha.");
    }
  }

  const btn =
    "inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted disabled:opacity-50";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {status === "ATIVA" ? (
        <button className={btn} disabled={alterar.isPending} onClick={() => aplicar("TRANCADA")}>
          <Lock className="h-3 w-3" /> Trancar
        </button>
      ) : null}
      {status === "TRANCADA" ? (
        <button className={btn} disabled={alterar.isPending} onClick={() => aplicar("ATIVA")}>
          <RotateCcw className="h-3 w-3" /> Reativar
        </button>
      ) : null}
      {status === "ATIVA" || status === "LISTA_ESPERA" || status === "TRANCADA" ? (
        <button
          className={cn(btn, "hover:border-danger/40 hover:text-danger")}
          disabled={alterar.isPending}
          onClick={() => aplicar("CANCELADA", "Cancelar a matrícula deste aluno?")}
        >
          <Ban className="h-3 w-3" /> Cancelar
        </button>
      ) : null}
      {erro ? <span className="text-xs text-danger">{erro}</span> : null}
    </div>
  );
}

/** Abre uma aula com data e conteúdo, depois leva à chamada. */
function NovaAula({ turmaId, onFechar }: { turmaId: string; onFechar: () => void }) {
  const router = useRouter();
  const criarAula = useCriarAula();
  const hoje = new Date().toISOString().slice(0, 10);
  const [data, setData] = useState(hoje);
  const [conteudo, setConteudo] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    try {
      const aula = await criarAula.mutateAsync({
        turmaId,
        dados: {
          data: new Date(`${data}T12:00:00`).toISOString(),
          ...(conteudo.trim() ? { conteudo: conteudo.trim() } : {}),
        },
      });
      router.push(`/capacitacao/turmas/${turmaId}/aulas/${aula.id}`);
    } catch (e) {
      setErro((e as Error).message || "Falha ao criar aula.");
    }
  }

  return (
    <form
      onSubmit={criar}
      className="mt-3 space-y-3 rounded-lg border border-border bg-surface p-4 shadow-casa-sm"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Nova aula</h3>
        <button type="button" onClick={onFechar} aria-label="Fechar" className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label="Data da aula" htmlFor="data-aula" obrigatorio>
          <Input id="data-aula" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </Campo>
        <Campo label="Conteúdo / tema" htmlFor="conteudo-aula" dica="Opcional.">
          <Input
            id="conteudo-aula"
            value={conteudo}
            onChange={(e) => setConteudo(e.target.value)}
            placeholder="Ex.: Técnicas de corte"
            maxLength={500}
          />
        </Campo>
      </div>
      {erro ? <Alerta tipo="erro">{erro}</Alerta> : null}
      <div className="flex justify-end">
        <Botao type="submit" carregando={criarAula.isPending}>
          <CalendarPlus className="h-4 w-4" /> Abrir aula e fazer chamada
        </Botao>
      </div>
    </form>
  );
}

/** Form inline para editar horário, sala e vagas da turma. */
function FormEditarTurma({ turma, onFechar }: { turma: TurmaDetalhe; onFechar: () => void }) {
  const editar = useEditarTurma();
  const [diasHorario, setDiasHorario] = useState(turma.diasHorario);
  const [sala, setSala] = useState(turma.sala ?? "");
  const [vagas, setVagas] = useState(String(turma.vagasTotais));
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const v = Number(vagas);
    if (!Number.isInteger(v) || v < 1) {
      setErro("Informe as vagas (mínimo 1).");
      return;
    }
    try {
      await editar.mutateAsync({
        id: turma.id,
        dados: { diasHorario: diasHorario.trim(), sala: sala.trim(), vagasTotais: v },
      });
      onFechar();
    } catch (err) {
      setErro((err as Error).message || "Falha ao salvar.");
    }
  }

  return (
    <form onSubmit={salvar} className="mt-3 space-y-3 rounded-lg border border-border bg-surface p-4 shadow-casa-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Editar turma</h3>
        <button type="button" onClick={onFechar} aria-label="Fechar" className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo label="Dias e horário" htmlFor="ed-dias" obrigatorio>
          <Input id="ed-dias" value={diasHorario} onChange={(e) => setDiasHorario(e.target.value)} />
        </Campo>
        <Campo label="Sala" htmlFor="ed-sala">
          <Input id="ed-sala" value={sala} onChange={(e) => setSala(e.target.value)} />
        </Campo>
        <Campo label="Vagas" htmlFor="ed-vagas" obrigatorio>
          <Input id="ed-vagas" type="number" min={1} max={100} value={vagas} onChange={(e) => setVagas(e.target.value)} />
        </Campo>
      </div>
      {erro ? <Alerta tipo="erro">{erro}</Alerta> : null}
      <div className="flex justify-end gap-2">
        <Botao type="button" variante="ghost" onClick={onFechar} disabled={editar.isPending}>Cancelar</Botao>
        <Botao type="submit" carregando={editar.isPending}>Salvar</Botao>
      </div>
    </form>
  );
}

export default function TurmaDetalhePage() {
  const { turmaId } = useParams<{ turmaId: string }>();
  const { data: turma, isLoading, isError, error } = useTurma(turmaId);
  const encerrarTurma = useEncerrarTurma();

  const [resumo, setResumo] = useState<ResumoEncerramentoTurma | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [matricularAberto, setMatricularAberto] = useState(false);
  const [novaAulaAberta, setNovaAulaAberta] = useState(false);
  const [editando, setEditando] = useState(false);

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
      <div className="rounded-lg border border-border bg-surface p-5 shadow-casa-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">{turma.curso.nome}</h1>
            <p className="text-sm text-muted-foreground">
              {turma.codigo} · {turma.diasHorario}
              {turma.sala ? ` · ${turma.sala}` : ""} · Instrutor: {turma.instrutor.user.nome}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!encerrada ? (
              <button
                type="button"
                onClick={() => setEditando((v) => !v)}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted"
              >
                <Pencil className="h-3 w-3" /> Editar
              </button>
            ) : null}
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
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          <ClipboardCheck className="mr-1 inline h-4 w-4 text-primary" />
          {turma.aulasEncerradas} aula(s) com chamada selada · carga{" "}
          {turma.curso.cargaHorariaTotal}h · presença mínima <strong>{minPct}%</strong>
        </p>
      </div>
      {editando ? <FormEditarTurma turma={turma} onFechar={() => setEditando(false)} /> : null}

      {resumo ? (
        <div className="mt-4">
          <Alerta tipo="info">
            🎓 Turma encerrada: <strong>{resumo.certificadosEmitidos} certificado(s)</strong>{" "}
            emitido(s), {resumo.evadidas} evasão(ões).
          </Alerta>
        </div>
      ) : null}
      {erroAcao ? <div className="mt-4"><Alerta>{erroAcao}</Alerta></div> : null}

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
              <div className="w-24">
                <div className="flex items-baseline justify-between text-xs">
                  <span className={abaixo ? "font-semibold text-danger" : "font-semibold text-success"}>
                    {m.presencaPct}%
                  </span>
                  <span className="text-muted-foreground">pres.</span>
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
              {!encerrada ? <AcoesMatricula matriculaId={m.id} status={m.status} /> : null}
            </li>
          );
        })}
      </ul>

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
      {!encerrada && novaAulaAberta ? (
        <NovaAula turmaId={turma.id} onFechar={() => setNovaAulaAberta(false)} />
      ) : null}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/capacitacao/turmas"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Turmas
        </Link>
        {!encerrada ? (
          <div className="flex gap-2">
            {!novaAulaAberta ? (
              <Botao variante="outline" onClick={() => setNovaAulaAberta(true)}>
                <CalendarPlus className="h-4 w-4" /> Nova aula
              </Botao>
            ) : null}
            <Botao onClick={encerrar} carregando={encerrarTurma.isPending}>
              <Stamp className="h-4 w-4" /> Encerrar turma
            </Botao>
          </div>
        ) : null}
      </div>
    </main>
  );
}
