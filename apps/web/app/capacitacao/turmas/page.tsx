"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, GraduationCap, Plus, Users, X } from "lucide-react";

import { STATUS_TURMA_LABEL, type StatusTurma } from "@/lib/api";
import { useCriarTurma, useCursos, useTurmas } from "@/lib/use-capacitacao";
import { Alerta, Botao, Campo, Input, Select, Spinner } from "@/components/ui";
import { ListRow, PageHeader } from "@/components/casa";
import { cn } from "@/lib/cn";

const statusEstilo: Record<StatusTurma, string> = {
  INSCRICOES_ABERTAS: "border-info/50 text-info",
  EM_ANDAMENTO: "border-primary/60 bg-primary/10 text-primary",
  ENCERRADA: "border-success/50 text-success",
};

/** Form de nova turma — curso, código, horário, vagas. */
function NovaTurma({ onFechar }: { onFechar: () => void }) {
  const { data: cursos } = useCursos();
  const criar = useCriarTurma();
  const [form, setForm] = useState({
    cursoId: "",
    codigo: "",
    diasHorario: "",
    sala: "",
    inicioEm: new Date().toISOString().slice(0, 10),
    vagasTotais: "12",
  });
  const [erro, setErro] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function salvar() {
    setErro(null);
    if (!form.cursoId || !form.codigo.trim() || !form.diasHorario.trim()) {
      setErro("Preencha curso, código e dias/horário.");
      return;
    }
    try {
      await criar.mutateAsync({
        cursoId: form.cursoId,
        codigo: form.codigo.trim().toUpperCase(),
        diasHorario: form.diasHorario.trim(),
        sala: form.sala.trim() || undefined,
        inicioEm: new Date(`${form.inicioEm}T08:00:00`).toISOString(),
        vagasTotais: Number(form.vagasTotais) || 12,
      });
      onFechar();
    } catch (e) {
      setErro((e as Error).message || "Falha ao criar turma.");
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-primary/30 bg-surface p-4 shadow-casa-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-foreground">Nova turma</h2>
        <button onClick={onFechar} aria-label="Fechar" className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Campo label="Curso" htmlFor="cursoId" obrigatorio>
          <Select id="cursoId" value={form.cursoId} onChange={set("cursoId")}>
            <option value="">Selecione…</option>
            {(cursos?.items ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} ({c.cargaHorariaTotal}h)
              </option>
            ))}
          </Select>
        </Campo>
        <Campo label="Código" htmlFor="codigo" obrigatorio dica="Único, ex.: BB-2026-4">
          <Input id="codigo" value={form.codigo} onChange={set("codigo")} maxLength={20} />
        </Campo>
        <Campo label="Dias e horário" htmlFor="dias" obrigatorio>
          <Input id="dias" value={form.diasHorario} onChange={set("diasHorario")} placeholder="Seg/Qua 14h-17h" maxLength={60} />
        </Campo>
        <Campo label="Sala" htmlFor="sala">
          <Input id="sala" value={form.sala} onChange={set("sala")} maxLength={40} />
        </Campo>
        <Campo label="Início" htmlFor="inicio" obrigatorio>
          <Input id="inicio" type="date" value={form.inicioEm} onChange={set("inicioEm")} />
        </Campo>
        <Campo label="Vagas" htmlFor="vagas" obrigatorio>
          <Input id="vagas" type="number" min={1} max={100} value={form.vagasTotais} onChange={set("vagasTotais")} />
        </Campo>
      </div>

      {erro ? <div className="mt-3"><Alerta>{erro}</Alerta></div> : null}

      <div className="mt-4 flex justify-end gap-2">
        <Botao variante="ghost" onClick={onFechar}>Cancelar</Botao>
        <Botao onClick={salvar} carregando={criar.isPending}>
          <Plus className="h-4 w-4" /> Criar turma
        </Botao>
      </div>
    </div>
  );
}

export default function TurmasPage() {
  const [filtroStatus, setFiltroStatus] = useState<string>("");
  const { data, isLoading, isError, error } = useTurmas({ status: filtroStatus || undefined });
  const [novaAberta, setNovaAberta] = useState(false);

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <PageHeader
        titulo="Minhas turmas"
        descricao="Crie turmas, matricule alunos, faça a chamada e emita certificados."
        acoes={
          !novaAberta ? (
            <Botao onClick={() => setNovaAberta(true)}>
              <Plus className="h-4 w-4" /> Nova turma
            </Botao>
          ) : undefined
        }
      />

      {/* Filtro por status (read-only — só estreita a listagem da unidade). */}
      <div className="mt-4 flex items-center gap-2">
        <label htmlFor="filtro-status" className="text-xs text-muted-foreground">
          Status:
        </label>
        <Select
          id="filtro-status"
          className="w-auto py-1 text-sm"
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
        >
          <option value="">Todas</option>
          {(Object.keys(STATUS_TURMA_LABEL) as StatusTurma[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_TURMA_LABEL[s]}
            </option>
          ))}
        </Select>
        {data ? (
          <span className="text-xs text-muted-foreground">{data.total} turma(s)</span>
        ) : null}
      </div>

      {novaAberta ? <NovaTurma onFechar={() => setNovaAberta(false)} /> : null}

      {isLoading ? <Spinner label="Carregando turmas..." /> : null}
      {isError ? (
        <div className="mt-6">
          <Alerta>Não foi possível carregar: {(error as Error)?.message}</Alerta>
        </div>
      ) : null}

      {data && data.items.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-muted-foreground">
          Nenhuma turma na sua unidade ainda.
        </div>
      ) : null}

      <div className="mt-6">
        {data?.items.map((t) => (
          <Link key={t.id} href={`/capacitacao/turmas/${t.id}`} className="group block">
            <ListRow
              className="transition group-hover:shadow-casa-sm"
              avatar={<GraduationCap className="h-5 w-5" />}
              titulo={
                <span className="group-hover:text-primary">
                  {t.curso.nome}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">{t.codigo}</span>
                </span>
              }
              subtitulo={`${t.diasHorario}${t.sala ? ` · ${t.sala}` : ""} · ${t.curso.cargaHorariaTotal}h`}
              trailing={
                <div className="flex items-center gap-3">
                  <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
                    <Users className="h-3.5 w-3.5" />
                    {t.alunosAtivos ?? t._count.matriculas}/{t.vagasTotais}
                    {t.ocupacaoPct != null ? ` · ${t.ocupacaoPct}%` : ""}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                      statusEstilo[t.status],
                    )}
                  >
                    {STATUS_TURMA_LABEL[t.status]}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                </div>
              }
            />
          </Link>
        ))}
      </div>
    </main>
  );
}
