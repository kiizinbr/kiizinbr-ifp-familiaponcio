"use client";

/**
 * Banco de Modelos da Capacitação (C4). Cursos práticos (ex.: barbearia)
 * precisam de pessoas reais para o aluno treinar. Aqui o instrutor cadastra
 * voluntários da comunidade, agenda SESSÕES PRÁTICAS por turma e faz o
 * matching aluno <-> modelo (quem atende quem).
 */
import { useMemo, useState } from "react";
import { Calendar, Plus, Scissors, UserPlus, Users, X } from "lucide-react";

import { Alerta, Botao, Campo, Input, Select, Spinner, Textarea } from "@/components/ui";
import { Card, Kpi, PageHeader, Pill, SecTitle } from "@/components/casa";
import {
  STATUS_INSCRICAO_LABEL,
  STATUS_SESSAO_LABEL,
  useCriarModelo,
  useCriarSessaoPratica,
  useInscreverModelo,
  useMatriculasSemestre,
  useModelosVoluntarios,
  useSessoesPraticas,
  useTurmas,
  useVincularAlunoModelo,
  type InscricaoModelo,
  type SessaoPratica,
  type StatusInscricaoModelo,
} from "@/lib/use-capacitacao";

/** Tom da pílula por situação da inscrição. */
function tomInscricao(status: StatusInscricaoModelo): "ok" | "warn" | "neutro" | "unidade" {
  if (status === "VINCULADO") return "unidade";
  if (status === "CONCLUIDO") return "ok";
  if (status === "CANCELADO") return "warn";
  return "neutro";
}

/** Form de novo modelo voluntário (cadastro da comunidade). */
function NovoModelo({ onFechar }: { onFechar: () => void }) {
  const criar = useCriarModelo();
  const [form, setForm] = useState({ nomeCompleto: "", telefone: "", observacao: "" });
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setErro(null);
    if (!form.nomeCompleto.trim()) {
      setErro("Informe o nome do modelo voluntário.");
      return;
    }
    try {
      await criar.mutateAsync({
        nomeCompleto: form.nomeCompleto.trim(),
        telefone: form.telefone.trim() || undefined,
        observacao: form.observacao.trim() || undefined,
      });
      onFechar();
    } catch (e) {
      setErro((e as Error).message || "Falha ao cadastrar modelo.");
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-primary/30 bg-surface p-4 shadow-casa-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-foreground">Novo modelo voluntário</h2>
        <button onClick={onFechar} aria-label="Fechar" className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Campo label="Nome completo" htmlFor="m-nome" obrigatorio>
          <Input
            id="m-nome"
            value={form.nomeCompleto}
            onChange={(e) => setForm((f) => ({ ...f, nomeCompleto: e.target.value }))}
            maxLength={120}
          />
        </Campo>
        <Campo label="Telefone" htmlFor="m-tel" dica="Para confirmar presença (opcional)">
          <Input
            id="m-tel"
            value={form.telefone}
            onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
            maxLength={20}
          />
        </Campo>
        <div className="sm:col-span-2">
          <Campo label="Observação" htmlFor="m-obs" dica="Preferências/restrições (ex.: só barba)">
            <Textarea
              id="m-obs"
              value={form.observacao}
              onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))}
              maxLength={280}
              rows={2}
            />
          </Campo>
        </div>
      </div>
      {erro ? <div className="mt-3"><Alerta>{erro}</Alerta></div> : null}
      <div className="mt-4 flex justify-end gap-2">
        <Botao variante="ghost" onClick={onFechar}>Cancelar</Botao>
        <Botao onClick={salvar} carregando={criar.isPending}>
          <Plus className="h-4 w-4" /> Cadastrar
        </Botao>
      </div>
    </div>
  );
}

/** Form de nova sessão prática (agenda por turma). */
function NovaSessao({ onFechar }: { onFechar: () => void }) {
  const { data: turmas } = useTurmas({ status: "EM_ANDAMENTO" });
  const criar = useCriarSessaoPratica();
  const [form, setForm] = useState({
    turmaId: "",
    titulo: "",
    data: new Date().toISOString().slice(0, 10),
    vagasModelos: "2",
    observacao: "",
  });
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setErro(null);
    if (!form.turmaId || !form.titulo.trim()) {
      setErro("Selecione a turma e dê um título à sessão.");
      return;
    }
    try {
      await criar.mutateAsync({
        turmaId: form.turmaId,
        titulo: form.titulo.trim(),
        data: new Date(`${form.data}T08:00:00`).toISOString(),
        vagasModelos: Number(form.vagasModelos) || 1,
        observacao: form.observacao.trim() || undefined,
      });
      onFechar();
    } catch (e) {
      setErro((e as Error).message || "Falha ao criar sessão.");
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-primary/30 bg-surface p-4 shadow-casa-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-foreground">Nova sessão prática</h2>
        <button onClick={onFechar} aria-label="Fechar" className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Campo label="Turma" htmlFor="s-turma" obrigatorio>
          <Select
            id="s-turma"
            value={form.turmaId}
            onChange={(e) => setForm((f) => ({ ...f, turmaId: e.target.value }))}
          >
            <option value="">Selecione…</option>
            {(turmas?.items ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.codigo} · {t.curso.nome}
              </option>
            ))}
          </Select>
        </Campo>
        <Campo label="Título" htmlFor="s-titulo" obrigatorio dica="Ex.: Sessão de cortes — módulo 2">
          <Input
            id="s-titulo"
            value={form.titulo}
            onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
            maxLength={80}
          />
        </Campo>
        <Campo label="Data" htmlFor="s-data" obrigatorio>
          <Input
            id="s-data"
            type="date"
            value={form.data}
            onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
          />
        </Campo>
        <Campo label="Vagas de modelos" htmlFor="s-vagas" obrigatorio>
          <Input
            id="s-vagas"
            type="number"
            min={1}
            max={50}
            value={form.vagasModelos}
            onChange={(e) => setForm((f) => ({ ...f, vagasModelos: e.target.value }))}
          />
        </Campo>
        <div className="sm:col-span-2">
          <Campo label="Observação" htmlFor="s-obs">
            <Textarea
              id="s-obs"
              value={form.observacao}
              onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))}
              maxLength={280}
              rows={2}
            />
          </Campo>
        </div>
      </div>
      {erro ? <div className="mt-3"><Alerta>{erro}</Alerta></div> : null}
      <div className="mt-4 flex justify-end gap-2">
        <Botao variante="ghost" onClick={onFechar}>Cancelar</Botao>
        <Botao onClick={salvar} carregando={criar.isPending}>
          <Plus className="h-4 w-4" /> Criar sessão
        </Botao>
      </div>
    </div>
  );
}

/** Card de uma sessão: inscrições + ações de matching (inscrever modelo, vincular aluno). */
function SessaoCard({ sessao }: { sessao: SessaoPratica }) {
  const { data: modelos } = useModelosVoluntarios();
  const inscrever = useInscreverModelo();
  const vincular = useVincularAlunoModelo();
  const [modeloId, setModeloId] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  // Modelos ativos que ainda não estão inscritos nesta sessão.
  const inscritosIds = useMemo(
    () => new Set(sessao.inscricoes.filter((i) => i.status !== "CANCELADO").map((i) => i.modelo.id)),
    [sessao.inscricoes],
  );
  const disponiveis = (modelos?.items ?? []).filter(
    (m) => m.ativo && !inscritosIds.has(m.id),
  );
  const lotada = sessao.vagasOcupadas >= sessao.vagasModelos;

  async function adicionar() {
    setErro(null);
    if (!modeloId) {
      setErro("Escolha um modelo voluntário.");
      return;
    }
    try {
      await inscrever.mutateAsync({ sessaoId: sessao.id, modeloId });
      setModeloId("");
    } catch (e) {
      setErro((e as Error).message || "Falha ao inscrever modelo.");
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-foreground">{sessao.titulo}</div>
          <div className="text-xs text-muted-foreground">
            {sessao.turma.codigo} · {sessao.turma.curso} ·{" "}
            {new Date(sessao.data).toLocaleDateString("pt-BR")}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Pill tom={sessao.status === "AGENDADA" ? "unidade" : "neutro"}>
            {STATUS_SESSAO_LABEL[sessao.status]}
          </Pill>
          <Pill tom={lotada ? "warn" : "neutro"}>
            {sessao.vagasOcupadas}/{sessao.vagasModelos} modelos
          </Pill>
        </div>
      </div>

      {sessao.observacao ? (
        <p className="mt-2 text-sm text-muted-foreground">{sessao.observacao}</p>
      ) : null}

      {/* Inscrições (matching) */}
      <div className="mt-4 space-y-2">
        {sessao.inscricoes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum modelo inscrito ainda.</p>
        ) : (
          sessao.inscricoes.map((i) => (
            <InscricaoLinha key={i.id} sessao={sessao} inscricao={i} vincular={vincular} />
          ))
        )}
      </div>

      {/* Inscrever modelo (só com vaga e em sessão agendada) */}
      {sessao.status === "AGENDADA" && !lotada ? (
        <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-border pt-3">
          <div className="min-w-[200px] flex-1">
            <Campo label="Inscrever modelo" htmlFor={`add-${sessao.id}`}>
              <Select
                id={`add-${sessao.id}`}
                value={modeloId}
                onChange={(e) => setModeloId(e.target.value)}
              >
                <option value="">Selecione…</option>
                {disponiveis.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nomeCompleto}
                  </option>
                ))}
              </Select>
            </Campo>
          </div>
          <Botao onClick={adicionar} carregando={inscrever.isPending}>
            <UserPlus className="h-4 w-4" /> Inscrever
          </Botao>
        </div>
      ) : null}

      {erro ? <div className="mt-3"><Alerta>{erro}</Alerta></div> : null}
    </Card>
  );
}

/** Uma inscrição: modelo + (aluno designado | seletor de aluno para vincular). */
function InscricaoLinha({
  sessao,
  inscricao,
  vincular,
}: {
  sessao: SessaoPratica;
  inscricao: InscricaoModelo;
  vincular: ReturnType<typeof useVincularAlunoModelo>;
}) {
  // Alunos ATIVOS da turma desta sessão (para o select de vínculo).
  const { data: matriculas } = useSessoesAlunos(sessao.turma.id);
  const [aberto, setAberto] = useState(false);
  const [matriculaId, setMatriculaId] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setErro(null);
    if (!matriculaId) {
      setErro("Escolha o aluno.");
      return;
    }
    try {
      await vincular.mutateAsync({ inscricaoId: inscricao.id, matriculaId });
      setAberto(false);
      setMatriculaId("");
    } catch (e) {
      setErro((e as Error).message || "Falha ao vincular aluno.");
    }
  }

  return (
    <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Scissors className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">{inscricao.modelo.nome}</span>
          <Pill tom={tomInscricao(inscricao.status)}>
            {STATUS_INSCRICAO_LABEL[inscricao.status]}
          </Pill>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {inscricao.aluno ? (
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> {inscricao.aluno.nome}
            </span>
          ) : null}
          {sessao.status === "AGENDADA" && inscricao.status !== "CANCELADO" ? (
            <button
              onClick={() => setAberto((v) => !v)}
              className="font-semibold text-primary hover:underline"
            >
              {inscricao.aluno ? "Trocar aluno" : "Vincular aluno"}
            </button>
          ) : null}
        </div>
      </div>

      {aberto ? (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-1">
            <Select value={matriculaId} onChange={(e) => setMatriculaId(e.target.value)}>
              <option value="">Selecione o aluno…</option>
              {(matriculas ?? []).map((a) => (
                <option key={a.matriculaId} value={a.matriculaId}>
                  {a.nome}
                </option>
              ))}
            </Select>
          </div>
          <Botao onClick={salvar} carregando={vincular.isPending}>
            Vincular
          </Botao>
        </div>
      ) : null}
      {erro ? <div className="mt-2"><Alerta>{erro}</Alerta></div> : null}
    </div>
  );
}

/** Alunos ATIVOS de uma turma (deriva das matrículas consolidadas do semestre). */
function useSessoesAlunos(turmaId: string) {
  const { data } = useMatriculasSemestreLocal();
  const alunos = useMemo(() => {
    const bloco = data?.turmas.find((t) => t.turmaId === turmaId);
    return (bloco?.alunos ?? [])
      .filter((a) => a.status === "ATIVA")
      .map((a) => ({ matriculaId: a.id, nome: a.aluno }));
  }, [data, turmaId]);
  return { data: alunos };
}

/** Atalho local para as matrículas ATIVAS (reusa o endpoint de semestre). */
function useMatriculasSemestreLocal() {
  return useMatriculasSemestre({ status: "ATIVA" });
}

export default function BancoModelosPage() {
  const { data, isLoading, error } = useSessoesPraticas();
  const { data: modelos } = useModelosVoluntarios();
  const [novaSessao, setNovaSessao] = useState(false);
  const [novoModelo, setNovoModelo] = useState(false);

  const agendadas = (data?.items ?? []).filter((s) => s.status === "AGENDADA").length;

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <PageHeader
        titulo="Banco de modelos"
        descricao="Voluntários da comunidade e sessões práticas (cortes supervisionados) — matching aluno e modelo."
        acoes={
          <div className="flex gap-2">
            {!novoModelo ? (
              <Botao variante="ghost" onClick={() => setNovoModelo(true)}>
                <Plus className="h-4 w-4" /> Modelo
              </Botao>
            ) : null}
            {!novaSessao ? (
              <Botao onClick={() => setNovaSessao(true)}>
                <Calendar className="h-4 w-4" /> Nova sessão
              </Botao>
            ) : null}
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Kpi label="Sessões" valor={data?.total ?? 0} />
        <Kpi label="Agendadas" valor={agendadas} />
        <Kpi label="Modelos cadastrados" valor={modelos?.total ?? 0} />
      </div>

      {novoModelo ? <NovoModelo onFechar={() => setNovoModelo(false)} /> : null}
      {novaSessao ? <NovaSessao onFechar={() => setNovaSessao(false)} /> : null}

      <div className="mt-6">
        <SecTitle icon={<Scissors />}>Sessões práticas</SecTitle>

        {isLoading ? <Spinner label="Carregando sessões..." /> : null}
        {error ? <Alerta>{(error as Error).message}</Alerta> : null}

        {data && data.items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-muted-foreground">
            Nenhuma sessão prática ainda. Crie uma para começar a agendar os modelos.
          </div>
        ) : null}

        <div className="space-y-3">
          {data?.items.map((s) => (
            <SessaoCard key={s.id} sessao={s} />
          ))}
        </div>
      </div>
    </main>
  );
}
