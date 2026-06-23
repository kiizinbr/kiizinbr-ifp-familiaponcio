"use client";

/**
 * Gestão de cursos do Centro de Capacitação. Um curso é o pré-requisito da turma
 * (define carga horária e presença mínima do certificado) — antes desta tela, só
 * existiam cursos vindos do seed. Permite criar, editar e ativar/desativar.
 */
import { useState } from "react";
import Link from "next/link";
import { BookOpen, GraduationCap, Pencil, Plus, X } from "lucide-react";

import { Alerta, Botao, Campo, Checkbox, Input, Select, Spinner } from "@/components/ui";
import { Card, PageHeader, Pill } from "@/components/casa";
import {
  MODALIDADE_LABEL,
  useAtualizarCurso,
  useCriarCurso,
  useCursosGestao,
  type CriarCursoPayload,
  type CursoGestao,
  type ModalidadeCurso,
} from "@/lib/use-capacitacao";

interface FormState {
  nome: string;
  modalidade: ModalidadeCurso;
  cargaHorariaTotal: string;
  presencaMinimaPct: string;
  requerModelos: boolean;
}

function estadoInicial(curso?: CursoGestao): FormState {
  return {
    nome: curso?.nome ?? "",
    modalidade: curso?.modalidade ?? "PRATICO",
    cargaHorariaTotal: curso ? String(curso.cargaHorariaTotal) : "",
    presencaMinimaPct: curso ? String(curso.presencaMinimaPct) : "75",
    requerModelos: curso?.requerModelos ?? false,
  };
}

function FormCurso({
  cursoEdit,
  aoFechar,
}: {
  cursoEdit?: CursoGestao;
  aoFechar: () => void;
}) {
  const criar = useCriarCurso();
  const atualizar = useAtualizarCurso();
  const [form, setForm] = useState<FormState>(() => estadoInicial(cursoEdit));
  const [erro, setErro] = useState<string | null>(null);
  const salvando = criar.isPending || atualizar.isPending;

  function set<K extends keyof FormState>(campo: K, valor: FormState[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!form.nome.trim()) {
      setErro("Informe o nome do curso.");
      return;
    }
    const carga = Number(form.cargaHorariaTotal);
    if (!Number.isInteger(carga) || carga < 1) {
      setErro("Informe a carga horária total (horas).");
      return;
    }
    const presenca = Number(form.presencaMinimaPct);
    if (!Number.isInteger(presenca) || presenca < 0 || presenca > 100) {
      setErro("A presença mínima deve estar entre 0 e 100.");
      return;
    }

    const payload: CriarCursoPayload = {
      nome: form.nome.trim(),
      modalidade: form.modalidade,
      cargaHorariaTotal: carga,
      presencaMinimaPct: presenca,
      requerModelos: form.requerModelos,
    };

    try {
      if (cursoEdit) {
        await atualizar.mutateAsync({ id: cursoEdit.id, dados: payload });
      } else {
        await criar.mutateAsync(payload);
      }
      aoFechar();
    } catch (error: unknown) {
      setErro(error instanceof Error ? error.message : "Falha ao salvar o curso.");
    }
  }

  return (
    <Card className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          {cursoEdit ? `Editar curso · ${cursoEdit.nome}` : "Novo curso"}
        </h3>
        <button onClick={aoFechar} aria-label="Fechar" className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <form onSubmit={salvar} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Nome do curso" htmlFor="nome" obrigatorio className="sm:col-span-2">
            <Input
              id="nome"
              value={form.nome}
              onChange={(e) => set("nome", e.target.value)}
              placeholder="Ex.: Barbearia Profissional"
            />
          </Campo>
          <Campo label="Modalidade" htmlFor="modalidade" obrigatorio>
            <Select
              id="modalidade"
              value={form.modalidade}
              onChange={(e) => set("modalidade", e.target.value as ModalidadeCurso)}
            >
              <option value="PRATICO">Prático</option>
              <option value="TEORICO">Teórico</option>
            </Select>
          </Campo>
          <Campo label="Carga horária total (h)" htmlFor="carga" obrigatorio>
            <Input
              id="carga"
              type="number"
              min={1}
              max={2000}
              value={form.cargaHorariaTotal}
              onChange={(e) => set("cargaHorariaTotal", e.target.value)}
              placeholder="40"
            />
          </Campo>
          <Campo
            label="Presença mínima (%)"
            htmlFor="presenca"
            dica="% de presença para emitir certificado."
          >
            <Input
              id="presenca"
              type="number"
              min={0}
              max={100}
              value={form.presencaMinimaPct}
              onChange={(e) => set("presencaMinimaPct", e.target.value)}
            />
          </Campo>
          <div className="flex items-end">
            <Checkbox
              id="requerModelos"
              label="Requer banco de modelos (fotos)"
              checked={form.requerModelos}
              onChange={(e) => set("requerModelos", e.target.checked)}
            />
          </div>
        </div>

        {erro ? <Alerta tipo="erro">{erro}</Alerta> : null}

        <div className="flex justify-end gap-2">
          <Botao type="button" variante="ghost" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={salvando}>
            {cursoEdit ? "Salvar alterações" : "Criar curso"}
          </Botao>
        </div>
      </form>
    </Card>
  );
}

function LinhaCurso({ curso, aoEditar }: { curso: CursoGestao; aoEditar: () => void }) {
  const atualizar = useAtualizarCurso();
  const [erro, setErro] = useState<string | null>(null);

  async function alternarAtivo() {
    setErro(null);
    try {
      await atualizar.mutateAsync({ id: curso.id, dados: { ativo: !curso.ativo } });
    } catch (error: unknown) {
      setErro(error instanceof Error ? error.message : "Falha ao atualizar.");
    }
  }

  return (
    <Card className={curso.ativo ? "" : "opacity-70"}>
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--unidade-suave)] text-[var(--unidade-escuro)]">
          <GraduationCap className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <Link
            href={`/capacitacao/cursos/${curso.id}`}
            className="font-semibold text-foreground hover:text-primary hover:underline"
          >
            {curso.nome}
          </Link>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Pill tom="unidade">{MODALIDADE_LABEL[curso.modalidade]}</Pill>
            <Pill>{curso.cargaHorariaTotal}h</Pill>
            <Pill>presença mín. {curso.presencaMinimaPct}%</Pill>
            <Pill>
              {curso._count.turmas} turma{curso._count.turmas === 1 ? "" : "s"}
            </Pill>
            {curso.ocupacaoPct != null ? (
              <Pill tom={curso.ocupacaoPct >= 90 ? "warn" : "unidade"}>
                ocupação {curso.ocupacaoPct}% ({curso.alunosAtivos}/{curso.vagasTotais})
              </Pill>
            ) : null}
            {!curso.ativo ? <Pill tom="warn">Inativo</Pill> : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Botao variante="outline" onClick={aoEditar}>
            <Pencil className="h-4 w-4" /> Editar
          </Botao>
          <Botao
            variante={curso.ativo ? "danger" : "primary"}
            onClick={alternarAtivo}
            carregando={atualizar.isPending}
          >
            {curso.ativo ? "Desativar" : "Ativar"}
          </Botao>
        </div>
      </div>
      {erro ? (
        <div className="mt-3">
          <Alerta tipo="erro">{erro}</Alerta>
        </div>
      ) : null}
    </Card>
  );
}

export default function PaginaCursos() {
  const [filtro, setFiltro] = useState<"" | "ativos" | "inativos">("");
  const { data, isLoading, error } = useCursosGestao(filtro || undefined);
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<CursoGestao | null>(null);

  const mostrandoForm = criando || editando !== null;

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <PageHeader
        titulo="Cursos"
        descricao="Cada turma nasce de um curso (carga horária e presença mínima do certificado)."
        acoes={
          !mostrandoForm ? (
            <Botao onClick={() => setCriando(true)}>
              <Plus className="h-4 w-4" /> Novo curso
            </Botao>
          ) : null
        }
      />

      {/* Filtro ativos/inativos (read-only — só estreita a listagem). */}
      <div className="mb-4 flex items-center gap-2">
        <label htmlFor="filtro-curso" className="text-xs text-muted-foreground">
          Exibir:
        </label>
        <Select
          id="filtro-curso"
          className="w-auto py-1 text-sm"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value as "" | "ativos" | "inativos")}
        >
          <option value="">Todos</option>
          <option value="ativos">Só ativos</option>
          <option value="inativos">Só inativos</option>
        </Select>
      </div>

      {mostrandoForm ? (
        <FormCurso
          cursoEdit={editando ?? undefined}
          aoFechar={() => {
            setCriando(false);
            setEditando(null);
          }}
        />
      ) : null}

      {isLoading ? <Spinner label="Carregando cursos..." /> : null}
      {error ? <Alerta tipo="erro">{(error as Error).message}</Alerta> : null}

      {data ? (
        <div className="space-y-3">
          {data.items.map((c) => (
            <LinhaCurso
              key={c.id}
              curso={c}
              aoEditar={() => {
                setCriando(false);
                setEditando(c);
              }}
            />
          ))}
          {data.items.length === 0 ? (
            <Card className="text-center text-sm text-muted-foreground">
              <BookOpen className="mx-auto mb-2 h-5 w-5" />
              Nenhum curso ainda — crie o primeiro em “Novo curso”.
            </Card>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
