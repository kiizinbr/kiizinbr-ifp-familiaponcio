"use client";

/**
 * Comunicados da unidade (console da equipe).
 *
 * Gestora/admin publica (geral ou por turma; crítico exige confirmação de
 * leitura no portal da família). Equipe acompanha o alcance: nº de leituras
 * por comunicado, com destaque para crítico ainda sem nenhuma confirmação.
 */
import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { ArrowLeft, BellRing, CheckCheck, Megaphone, Plus } from "lucide-react";

import { Alerta, Botao, Campo, Checkbox, Input, Select, Spinner, Textarea } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  useComunicadosUnidade,
  useCriarComunicado,
  useTurmasInfantis,
  type CriarComunicadoPayload,
} from "@/lib/use-educacional";

const PERFIS_PUBLICAR = ["SUPER_ADMIN", "GESTOR_UNIDADE"];

interface FormComunicado {
  titulo: string;
  corpo: string;
  critico: boolean;
  turmaId: string;
}

function FormNovoComunicado({ aoFechar }: { aoFechar: () => void }) {
  const { data: turmas } = useTurmasInfantis();
  const criar = useCriarComunicado();
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormComunicado>({
    defaultValues: { titulo: "", corpo: "", critico: false, turmaId: "" },
    mode: "onTouched",
  });

  async function publicar(v: FormComunicado) {
    setErroEnvio(null);
    const payload: CriarComunicadoPayload = {
      titulo: v.titulo.trim(),
      corpo: v.corpo.trim(),
      critico: v.critico,
      ...(v.turmaId ? { turmaId: v.turmaId } : {}),
    };
    try {
      await criar.mutateAsync(payload);
      aoFechar();
    } catch (error: unknown) {
      setErroEnvio(error instanceof Error ? error.message : "Falha ao publicar comunicado");
    }
  }

  return (
    <form
      onSubmit={handleSubmit(publicar)}
      className="mt-4 space-y-4 rounded-lg border border-border bg-surface p-4"
    >
      <Campo label="Título" htmlFor="titulo" obrigatorio erro={errors.titulo?.message}>
        <Input
          id="titulo"
          placeholder="Ex.: Reunião de pais — sexta 18h"
          {...register("titulo", {
            required: "Informe o título",
            minLength: { value: 3, message: "Mínimo de 3 caracteres" },
          })}
        />
      </Campo>

      <Campo label="Mensagem" htmlFor="corpo" obrigatorio erro={errors.corpo?.message}>
        <Textarea
          id="corpo"
          rows={4}
          placeholder="Texto que a família verá no portal"
          {...register("corpo", {
            required: "Escreva a mensagem",
            minLength: { value: 3, message: "Mínimo de 3 caracteres" },
          })}
        />
      </Campo>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          label="Destino"
          htmlFor="turmaId"
          dica="Sem turma selecionada, vale para toda a unidade."
        >
          <Select id="turmaId" {...register("turmaId")}>
            <option value="">Toda a unidade</option>
            {turmas?.items.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </Select>
        </Campo>

        <Campo
          label="Prioridade"
          dica="Crítico pede confirmação de leitura do responsável."
        >
          <div className="rounded-md border border-border bg-background px-3 py-2">
            <Checkbox id="critico" label="Comunicado crítico" {...register("critico")} />
          </div>
        </Campo>
      </div>

      {erroEnvio ? <Alerta tipo="erro">{erroEnvio}</Alerta> : null}

      <div className="flex justify-end gap-2">
        <Botao type="button" variante="ghost" onClick={aoFechar} disabled={criar.isPending}>
          Cancelar
        </Botao>
        <Botao type="submit" carregando={criar.isPending}>
          Publicar
        </Botao>
      </div>
    </form>
  );
}

export default function ComunicadosPage() {
  const { data: session } = useSession();
  const { data, isLoading, error } = useComunicadosUnidade();
  const { data: turmas } = useTurmasInfantis();
  const [criando, setCriando] = useState(false);

  const podePublicar = session?.perfis?.some((p) => PERFIS_PUBLICAR.includes(p)) ?? false;
  const nomeTurma = (turmaId: string | null) =>
    turmaId ? (turmas?.items.find((t) => t.id === turmaId)?.nome ?? "Turma") : null;

  if (isLoading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Spinner label="Carregando comunicados..." />
      </main>
    );
  }
  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Alerta tipo="erro">{(error as Error).message}</Alerta>
      </main>
    );
  }

  const comunicados = data?.items ?? [];

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <Link
        href="/educacional"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Painel do dia
      </Link>

      <div className="mt-2 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
          <Megaphone className="h-5 w-5 text-primary" /> Comunicados
        </h1>
        {podePublicar && !criando ? (
          <Botao onClick={() => setCriando(true)}>
            <Plus className="h-4 w-4" /> Novo comunicado
          </Botao>
        ) : null}
      </div>

      {criando ? <FormNovoComunicado aoFechar={() => setCriando(false)} /> : null}

      <ul className="mt-6 space-y-3">
        {comunicados.map((c) => {
          const semLeituraCritica = c.critico && c._count.leituras === 0;
          const turma = nomeTurma(c.turmaId);
          return (
            <li
              key={c.id}
              className={cn(
                "rounded-lg border px-4 py-3",
                semLeituraCritica ? "border-warning/60 bg-warning/10" : "border-border bg-surface",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">{c.titulo}</p>
                {c.critico ? (
                  <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-warning">
                    <BellRing className="h-3.5 w-3.5" /> CRÍTICO
                  </span>
                ) : null}
              </div>
              <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{c.corpo}</p>
              <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                {new Date(c.criadoEm).toLocaleString("pt-BR")}
                <span>· {turma ?? "Toda a unidade"}</span>
                <span
                  className={cn(
                    "flex items-center gap-1",
                    semLeituraCritica ? "font-semibold text-warning" : "text-success",
                  )}
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  {c._count.leituras}{" "}
                  {c._count.leituras === 1 ? "confirmação" : "confirmações"}
                </span>
              </p>
            </li>
          );
        })}
        {comunicados.length === 0 && (
          <li className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            <Megaphone className="mx-auto mb-2 h-5 w-5" />
            Nenhum comunicado publicado ainda.
            {podePublicar ? " Use “Novo comunicado” para falar com as famílias." : ""}
          </li>
        )}
      </ul>
    </main>
  );
}
