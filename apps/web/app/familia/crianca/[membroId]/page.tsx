"use client";

/**
 * Tela 3 do portal: ficha da criança — quem pode buscar, alergias e
 * autorizações de imagem (visão de leitura do responsável).
 */
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Camera, ShieldCheck } from "lucide-react";

import { Alerta, Spinner } from "@/components/ui";
import { idade } from "@/lib/idade";
import { cn } from "@/lib/cn";
import { ESCOPO_IMAGEM_LABEL, useFichaCrianca } from "@/lib/use-educacional";

export default function FichaCriancaFamiliaPage({
  params,
}: {
  params: { membroId: string };
}) {
  const { membroId } = params;
  const { data, isLoading, error } = useFichaCrianca(membroId);

  if (isLoading) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <Spinner label="Carregando ficha..." />
      </main>
    );
  }
  if (error || !data) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <Alerta tipo="erro">{(error as Error)?.message ?? "Ficha não encontrada"}</Alerta>
      </main>
    );
  }

  const { crianca, autorizados, autorizacoesImagem } = data;

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <Link
        href="/familia/crianca"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Minhas crianças
      </Link>

      <h1 className="mt-2 text-lg font-bold text-foreground">{crianca.nomeCompleto}</h1>
      <p className="text-xs text-muted-foreground">
        {idade(crianca.dataNascimento)} anos
      </p>

      {crianca.alergias.length > 0 && (
        <div className="mt-4 rounded-xl border border-danger/60 bg-danger/10 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-bold text-danger">
            <AlertTriangle className="h-4 w-4" /> Alergias que a equipe acompanha
          </p>
          <ul className="mt-1 text-sm text-foreground">
            {crianca.alergias.map((a) => (
              <li key={a.id}>{a.descricao}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="mt-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" /> Quem pode buscar
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Só estas pessoas podem retirar sua criança. Para mudar a lista, fale com a
          secretaria.
        </p>
        <ul className="mt-3 space-y-2">
          {autorizados.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3"
            >
              {a.fotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.fotoUrl}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {a.nome
                    .split(/\s+/)
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </span>
              )}
              <div>
                <p className="text-sm font-semibold text-foreground">{a.nome}</p>
                <p className="text-xs capitalize text-muted-foreground">{a.parentesco}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Camera className="h-4 w-4 text-primary" /> Uso de imagem
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Você decide onde a imagem da sua criança pode aparecer. Sem a sua autorização,
          a resposta é sempre NÃO.
        </p>
        <ul className="mt-3 grid gap-2">
          {autorizacoesImagem.map((a) => (
            <li
              key={a.escopo}
              className={cn(
                "flex items-center justify-between rounded-xl border px-4 py-3 text-sm",
                a.concedido && !a.revogadoEm
                  ? "border-success/60 bg-success/10"
                  : "border-border bg-surface",
              )}
            >
              <span className="text-foreground">{ESCOPO_IMAGEM_LABEL[a.escopo]}</span>
              <span
                className={cn(
                  "text-xs font-bold",
                  a.concedido && !a.revogadoEm ? "text-success" : "text-muted-foreground",
                )}
              >
                {a.concedido && !a.revogadoEm ? "Autorizado" : "Não autorizado"}
              </span>
            </li>
          ))}
          {autorizacoesImagem.length === 0 && (
            <li className="text-xs text-muted-foreground">
              Nenhuma autorização concedida — tudo negado por padrão.
            </li>
          )}
        </ul>
      </section>
    </main>
  );
}
