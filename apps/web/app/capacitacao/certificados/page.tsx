"use client";

/**
 * Certificados emitidos na unidade — consulta e 2ª via. Cada certificado é
 * emitido no encerramento de uma turma para quem atingiu a presença mínima;
 * aqui a equipe consulta, verifica (página pública) e baixa o PDF com QR.
 */
import Link from "next/link";
import { Award, ExternalLink, FileDown } from "lucide-react";

import { Alerta, Spinner } from "@/components/ui";
import { Card, PageHeader, Pill } from "@/components/casa";
import { API_BASE_URL } from "@/lib/api";
import { useCertificados } from "@/lib/use-capacitacao";

function dataBR(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function PaginaCertificados() {
  const { data, isLoading, error } = useCertificados();

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <PageHeader
        titulo="Certificados"
        descricao="Emitidos no encerramento das turmas — consulta e 2ª via com QR."
      />

      {isLoading ? <Spinner label="Carregando certificados..." /> : null}
      {error ? <Alerta tipo="erro">{(error as Error).message}</Alerta> : null}

      {data ? (
        <div className="space-y-3">
          {data.items.map((c) => (
            <Card key={c.id}>
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
                  <Award className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-foreground">{c.aluno}</div>
                  <div className="text-sm text-muted-foreground">
                    {c.curso} · {c.turma}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Pill tom="unidade">{c.cargaHorariaCumprida}h</Pill>
                    <Pill>{c.presencaPct}% presença</Pill>
                    <Pill>emitido {dataBR(c.emitidoEm)}</Pill>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/verificar/${c.codigoVerificacao}`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-muted"
                  >
                    <ExternalLink className="h-4 w-4" /> Verificar
                  </Link>
                  <a
                    href={`${API_BASE_URL}/capacitacao/certificados/verificar/${c.codigoVerificacao}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-ifp-sm transition hover:bg-primary-hover"
                  >
                    <FileDown className="h-4 w-4" /> PDF
                  </a>
                </div>
              </div>
            </Card>
          ))}
          {data.items.length === 0 ? (
            <Card className="text-center text-sm text-muted-foreground">
              <Award className="mx-auto mb-2 h-5 w-5" />
              Nenhum certificado emitido ainda — eles aparecem aqui quando uma turma é
              encerrada.
            </Card>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
