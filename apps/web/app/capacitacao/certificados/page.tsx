"use client";

/**
 * Certificados emitidos na unidade — consulta e 2ª via. Cada certificado é
 * emitido no encerramento de uma turma para quem atingiu a presença mínima;
 * aqui a equipe consulta, verifica (página pública) e baixa o PDF com QR.
 */
import { useState } from "react";
import Link from "next/link";
import { Award, ExternalLink, FileDown, Search, X } from "lucide-react";

import { Alerta, Botao, Campo, Input, Select, Spinner } from "@/components/ui";
import { Card, PageHeader, Pill } from "@/components/casa";
import { API_BASE_URL } from "@/lib/api";
import { useCertificados, useCursosGestao } from "@/lib/use-capacitacao";

function dataBR(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function PaginaCertificados() {
  const [busca, setBusca] = useState("");
  const [cursoId, setCursoId] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const { data: cursos } = useCursosGestao();
  const { data, isLoading, isFetching, error } = useCertificados({
    q: busca,
    cursoId: cursoId || undefined,
    de: de || undefined,
    ate: ate || undefined,
  });

  const temFiltro = Boolean(busca.trim() || cursoId || de || ate);
  function limpar() {
    setBusca("");
    setCursoId("");
    setDe("");
    setAte("");
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <PageHeader
        titulo="Certificados"
        descricao="Emitidos no encerramento das turmas — consulta e 2ª via com QR."
      />

      {/* Filtros (read-only — só estreitam a listagem da unidade; o servidor
          aplica busca/curso/período e mantém o isolamento de tenant). */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[15rem] flex-1">
            <Campo label="Buscar" htmlFor="busca-cert">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="busca-cert"
                  placeholder="Aluno, código ou curso…"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-9"
                />
              </div>
            </Campo>
          </div>
          <Campo label="Curso" htmlFor="curso-cert">
            <Select id="curso-cert" value={cursoId} onChange={(e) => setCursoId(e.target.value)}>
              <option value="">Todos</option>
              {(cursos?.items ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo label="Emitido de" htmlFor="de-cert">
            <Input id="de-cert" type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          </Campo>
          <Campo label="até" htmlFor="ate-cert">
            <Input id="ate-cert" type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          </Campo>
          {temFiltro ? (
            <Botao variante="ghost" onClick={limpar}>
              <X className="h-4 w-4" /> Limpar
            </Botao>
          ) : null}
        </div>
      </Card>

      {isLoading ? <Spinner label="Carregando certificados..." /> : null}
      {error ? <Alerta tipo="erro">{(error as Error).message}</Alerta> : null}

      {data ? (
        <div className={isFetching ? "space-y-3 opacity-70" : "space-y-3"}>
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
              {temFiltro
                ? "Nenhum certificado encontrado com esses filtros."
                : "Nenhum certificado emitido ainda — eles aparecem aqui quando uma turma é encerrada."}
            </Card>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
