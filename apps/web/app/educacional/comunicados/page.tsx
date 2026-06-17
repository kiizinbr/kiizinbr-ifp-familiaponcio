"use client";

/**
 * Comunicados da unidade (gestora): lista os avisos publicados com a contagem
 * de confirmações de leitura e permite publicar um novo (geral ou por turma).
 * Comunicado "crítico" exige confirmação de leitura da família.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BellRing, Megaphone, Plus, X } from "lucide-react";

import {
  Alerta,
  Botao,
  Campo,
  Checkbox,
  Input,
  Select,
  Spinner,
  Textarea,
} from "@/components/ui";
import {
  useComunicadosGestora,
  useCriarComunicado,
  useTurmasInfantis,
} from "@/lib/use-educacional";

/** Form de novo comunicado — título, mensagem, alvo (turma ou geral) e criticidade. */
function NovoComunicado({ onFechar }: { onFechar: () => void }) {
  const { data: turmas } = useTurmasInfantis();
  const criar = useCriarComunicado();
  const [form, setForm] = useState({
    titulo: "",
    corpo: "",
    critico: false,
    turmaId: "",
  });
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setErro(null);
    if (form.titulo.trim().length < 3 || form.corpo.trim().length < 3) {
      setErro("Título e mensagem precisam de pelo menos 3 caracteres.");
      return;
    }
    try {
      await criar.mutateAsync({
        titulo: form.titulo.trim(),
        corpo: form.corpo.trim(),
        critico: form.critico,
        turmaId: form.turmaId || undefined,
      });
      onFechar();
    } catch (e) {
      setErro((e as Error).message || "Falha ao publicar comunicado.");
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-primary/30 bg-surface p-4 shadow-casa-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-foreground">Novo comunicado</h2>
        <button
          onClick={onFechar}
          aria-label="Fechar"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 space-y-3">
        <Campo label="Título" htmlFor="titulo" obrigatorio>
          <Input
            id="titulo"
            value={form.titulo}
            onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
            maxLength={120}
            placeholder="Ex.: Reunião de pais na sexta"
          />
        </Campo>
        <Campo label="Mensagem" htmlFor="corpo" obrigatorio>
          <Textarea
            id="corpo"
            value={form.corpo}
            onChange={(e) => setForm((f) => ({ ...f, corpo: e.target.value }))}
            rows={4}
          />
        </Campo>
        <Campo
          label="Turma"
          htmlFor="turma"
          dica="Em branco = envia para todas as turmas da unidade."
        >
          <Select
            id="turma"
            value={form.turmaId}
            onChange={(e) => setForm((f) => ({ ...f, turmaId: e.target.value }))}
          >
            <option value="">Toda a unidade</option>
            {(turmas?.items ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </Select>
        </Campo>
        <div className="rounded-md border border-warning/40 bg-warning/5 px-3 py-2">
          <Checkbox
            id="critico"
            label="Crítico — exige confirmação de leitura da família"
            checked={form.critico}
            onChange={(e) => setForm((f) => ({ ...f, critico: e.target.checked }))}
          />
        </div>
      </div>

      {erro ? (
        <div className="mt-3">
          <Alerta>{erro}</Alerta>
        </div>
      ) : null}

      <div className="mt-4 flex justify-end gap-2">
        <Botao variante="ghost" onClick={onFechar}>
          Cancelar
        </Botao>
        <Botao onClick={salvar} carregando={criar.isPending}>
          <Plus className="h-4 w-4" /> Publicar
        </Botao>
      </div>
    </div>
  );
}

export default function ComunicadosPage() {
  const { data, isLoading, isError, error } = useComunicadosGestora();
  const { data: turmas } = useTurmasInfantis();
  const [novoAberto, setNovoAberto] = useState(false);

  // Cruza turmaId -> nome para mostrar o alvo do comunicado de forma legível.
  const nomeTurma = useMemo(() => {
    const map = new Map((turmas?.items ?? []).map((t) => [t.id, t.nome]));
    return (id: string | null) =>
      id ? map.get(id) ?? "Turma" : "Toda a unidade";
  }, [turmas]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href="/educacional"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Painel
      </Link>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
          <Megaphone className="h-5 w-5" /> Comunicados
        </h1>
        {!novoAberto ? (
          <Botao onClick={() => setNovoAberto(true)}>
            <Plus className="h-4 w-4" /> Novo comunicado
          </Botao>
        ) : null}
      </div>

      {novoAberto ? <NovoComunicado onFechar={() => setNovoAberto(false)} /> : null}

      {isLoading ? <Spinner label="Carregando comunicados..." /> : null}
      {isError ? (
        <div className="mt-6">
          <Alerta>Não foi possível carregar: {(error as Error)?.message}</Alerta>
        </div>
      ) : null}

      <ul className="mt-6 space-y-3">
        {data?.items.map((c) => (
          <li
            key={c.id}
            className="rounded-lg border border-border bg-surface p-4 shadow-ifp-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold text-foreground">{c.titulo}</h3>
              {c.critico ? (
                <span className="flex shrink-0 items-center gap-1 rounded-full border border-warning/60 bg-warning/10 px-2.5 py-0.5 text-xs font-semibold text-warning">
                  <BellRing className="h-3 w-3" /> Crítico
                </span>
              ) : null}
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
              {c.corpo}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>{nomeTurma(c.turmaId)}</span>
              <span aria-hidden>·</span>
              <span>{new Date(c.criadoEm).toLocaleString("pt-BR")}</span>
              <span aria-hidden>·</span>
              <span
                className={
                  c.critico && c._count.leituras === 0
                    ? "font-semibold text-warning"
                    : ""
                }
              >
                {c._count.leituras} confirmação(ões) de leitura
              </span>
            </div>
          </li>
        ))}
        {data && data.items.length === 0 ? (
          <li className="mt-4 rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-muted-foreground">
            Nenhum comunicado publicado ainda.
          </li>
        ) : null}
      </ul>
    </main>
  );
}
