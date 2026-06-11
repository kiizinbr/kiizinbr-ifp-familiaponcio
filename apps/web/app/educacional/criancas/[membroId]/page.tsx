"use client";

/**
 * Perfil da criança (console da equipe): alergias em destaque, autorizados
 * (restrição judicial em vermelho), autorizações de imagem por escopo e
 * histórico de check-in/out.
 */
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Camera, Lock, ShieldCheck } from "lucide-react";

import { Alerta, Spinner } from "@/components/ui";
import { idade } from "@/lib/idade";
import { cn } from "@/lib/cn";
import {
  ESCOPO_IMAGEM_LABEL,
  usePerfilCrianca,
} from "@/lib/use-educacional";

export default function PerfilCriancaPage({
  params,
}: {
  params: { membroId: string };
}) {
  const { membroId } = params;
  const { data, isLoading, error } = usePerfilCrianca(membroId);

  if (isLoading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Spinner label="Carregando perfil..." />
      </main>
    );
  }
  if (error || !data) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Alerta tipo="erro">{(error as Error)?.message ?? "Criança não encontrada"}</Alerta>
      </main>
    );
  }

  const { crianca, matricula, autorizados, autorizacoesImagem, ultimosChecks } = data;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <Link
        href={`/educacional/turmas/${matricula.turma.id}`}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {matricula.turma.nome}
      </Link>

      <h1 className="mt-2 text-xl font-bold text-foreground">{crianca.nomeCompleto}</h1>
      <p className="text-xs text-muted-foreground">
        {idade(crianca.dataNascimento)} anos · {matricula.turma.nome} · Resp.{" "}
        {crianca.ficha.nomeCompleto} ({crianca.ficha.telefone})
      </p>

      {crianca.alergias.length > 0 && (
        <div className="mt-4 rounded-lg border border-danger/60 bg-danger/10 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-bold text-danger">
            <AlertTriangle className="h-4 w-4" /> Alergias
          </p>
          <ul className="mt-1 text-sm text-foreground">
            {crianca.alergias.map((a) => (
              <li key={a.id}>
                {a.descricao} <span className="text-xs text-danger">({a.gravidade})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="mt-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <ShieldCheck className="h-4 w-4" /> Autorizados a entregar/retirar
        </h2>
        <ul className="mt-2 space-y-2">
          {autorizados.map((a) => {
            const bloqueado = Boolean(a.revogadoEm || a.restricaoJudicial);
            return (
              <li
                key={a.id}
                className={cn(
                  "flex items-center justify-between rounded-lg border px-4 py-2.5 text-sm",
                  bloqueado
                    ? "border-danger/60 bg-danger/10"
                    : "border-border bg-surface",
                )}
              >
                <div>
                  <p className="font-semibold text-foreground">{a.nome}</p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {a.parentesco} · doc. {a.documento}
                  </p>
                </div>
                {a.restricaoJudicial ? (
                  <span className="flex items-center gap-1 text-xs font-bold text-danger">
                    <Lock className="h-3.5 w-3.5" /> RESTRIÇÃO JUDICIAL
                  </span>
                ) : a.revogadoEm ? (
                  <span className="text-xs font-semibold text-danger">Revogado</span>
                ) : (
                  <span className="text-xs font-semibold text-success">Ativo</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Camera className="h-4 w-4" /> Autorizações de imagem (default: negado)
        </h2>
        <ul className="mt-2 grid gap-2 sm:grid-cols-3">
          {autorizacoesImagem.map((a) => (
            <li
              key={a.escopo}
              className={cn(
                "rounded-lg border px-3 py-2 text-xs",
                a.concedido && !a.revogadoEm
                  ? "border-success/60 bg-success/10 text-foreground"
                  : "border-border bg-surface text-muted-foreground",
              )}
            >
              <p className="font-semibold">{ESCOPO_IMAGEM_LABEL[a.escopo]}</p>
              <p className="mt-0.5 font-bold">
                {a.concedido && !a.revogadoEm ? "Concedida" : "Negada"}
              </p>
            </li>
          ))}
          {autorizacoesImagem.length === 0 && (
            <li className="text-xs text-muted-foreground">
              Nenhuma declaração — tudo negado por padrão.
            </li>
          )}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Últimos check-ins/outs
        </h2>
        <ul className="mt-2 space-y-1">
          {ultimosChecks.map((c) => (
            <li key={c.id} className="text-xs text-muted-foreground">
              <span
                className={cn(
                  "font-semibold",
                  c.sentido === "ENTRADA" ? "text-success" : "text-info",
                )}
              >
                {c.sentido === "ENTRADA" ? "Entrada" : "Saída"}
              </span>{" "}
              · {new Date(c.ocorridoEm).toLocaleString("pt-BR")} · com {c.autorizado.nome}{" "}
              ({c.autorizado.parentesco})
            </li>
          ))}
          {ultimosChecks.length === 0 && (
            <li className="text-xs text-muted-foreground">Nenhum registro ainda.</li>
          )}
        </ul>
      </section>
    </main>
  );
}
