"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";

import {
  asOptions,
  STATUS_LABEL,
  UNIDADES,
  type StatusElegibilidade,
} from "@/lib/api";
import { useFichas, type FichasQuery } from "@/lib/use-fichas";
import { formatCpf, formatTelefone, idadeAnos } from "@/lib/format";
import { Alerta, BadgeStatus, Botao, Input, Select, Spinner } from "@/components/ui";

const PER_PAGE = 20;
const statusOptions = asOptions(STATUS_LABEL);

export default function FichasListaPage() {
  const searchParams = useSearchParams();
  const statusInicial = (searchParams.get("status") ?? "") as StatusElegibilidade | "";

  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [unidade, setUnidade] = useState("");
  const [status, setStatus] = useState<StatusElegibilidade | "">(statusInicial);
  const [page, setPage] = useState(1);

  // Debounce: só dispara a busca 400ms após parar de digitar.
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(qInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [qInput]);

  const params: FichasQuery = { page, perPage: PER_PAGE, q, unidade, status };
  const { data, isLoading, isError, error, isFetching } = useFichas(params);

  const totalPages = data?.pagination.totalPages ?? 1;
  const total = data?.pagination.total ?? 0;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fichas Cidadãs</h1>
          <p className="text-sm text-muted-foreground">
            Famílias atendidas pelo Serviço Social.
          </p>
        </div>
        <Link href="/servico-social/fichas/nova">
          <Botao>
            <Plus className="h-4 w-4" />
            Nova ficha
          </Botao>
        </Link>
      </div>

      {/* Barra de filtros */}
      <div className="mb-6 grid gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Buscar por nome, CPF ou protocolo..."
            className="pl-9"
            aria-label="Buscar fichas"
          />
        </div>
        <Select
          value={unidade}
          onChange={(e) => {
            setUnidade(e.target.value);
            setPage(1);
          }}
          aria-label="Filtrar por unidade"
        >
          <option value="">Todas as unidades</option>
          {UNIDADES.map((u) => (
            <option key={u.slug} value={u.slug}>
              {u.nome}
            </option>
          ))}
        </Select>
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as StatusElegibilidade | "");
            setPage(1);
          }}
          aria-label="Filtrar por status"
        >
          <option value="">Todos os status</option>
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>

      {/* Resultados */}
      {isLoading ? (
        <Spinner label="Carregando fichas..." />
      ) : isError ? (
        <Alerta>
          Não foi possível carregar as fichas: {(error as Error)?.message ?? "erro desconhecido"}
        </Alerta>
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">
            {q || unidade || status
              ? "Nenhuma ficha encontrada com esses filtros."
              : "Nenhuma ficha cadastrada ainda."}
          </p>
          <Link href="/servico-social/fichas/nova" className="mt-3 inline-block">
            <Botao variante="outline">
              <Plus className="h-4 w-4" />
              Cadastrar a primeira
            </Botao>
          </Link>
        </div>
      ) : (
        <>
          <ul className="space-y-2">
            {data.items.map((f) => {
              const idade = idadeAnos(f.dataNascimento);
              return (
                <li key={f.id}>
                  <Link
                    href={`/servico-social/fichas/${f.id}`}
                    className="block rounded-lg border border-border bg-surface p-4 transition hover:border-ifp-orange hover:shadow-ifp-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground">
                          {f.nomeCompleto}
                          {!f.ativa ? (
                            <span className="ml-2 text-xs font-normal text-danger">(inativa)</span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {f.protocolo} · CPF {formatCpf(f.cpf)} · {formatTelefone(f.telefone)}
                          {idade !== null ? ` · ${idade} anos` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {f.elegibilidades.length === 0 ? (
                          <span className="text-xs text-muted-foreground">sem elegibilidade</span>
                        ) : (
                          f.elegibilidades.map((e) => (
                            <span key={e.id} className="flex items-center gap-1">
                              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                {e.unidade.slug}
                              </span>
                              <BadgeStatus status={e.status} />
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Paginação */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {total} ficha(s) · página {page} de {totalPages}
              {isFetching ? " · atualizando..." : ""}
            </p>
            <div className="flex gap-2">
              <Botao
                variante="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Botao>
              <Botao
                variante="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Botao>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
