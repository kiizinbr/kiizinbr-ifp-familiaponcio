"use client";

/**
 * Visualizador da trilha de auditoria (governança LGPD). Só SUPER_ADMIN (o
 * backend garante 403 para os demais; o layout do /admin já barra quem não é
 * admin/gestor, e esta tela some do rail para gestor). Filtros por ator/ação/
 * entidade/período, paginação e export CSV (o próprio export vira evento EXPORT).
 */
import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Download, Filter, ShieldCheck } from "lucide-react";

import { Alerta, Botao, Campo, Input, Select, Spinner } from "@/components/ui";
import { Card, PageHeader, Pill } from "@/components/casa";
import {
  ACAO_AUDITORIA_LABEL,
  urlExportAuditoria,
  useAuditoria,
  useAuditoriaFacetas,
  type AcaoAuditoria,
  type AuditoriaFiltros,
} from "@/lib/use-admin";

const PER_PAGE = 30;

const ACAO_TOM: Partial<Record<AcaoAuditoria, "ok" | "warn" | "neutro" | "unidade">> = {
  CREATE: "ok",
  READ: "neutro",
  UPDATE: "unidade",
  DELETE: "warn",
  EXPORT: "warn",
  LOGIN: "neutro",
  LOGOUT: "neutro",
};

function dataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" });
}

export default function PaginaAuditoria() {
  const { data: session } = useSession();
  const ehAdmin = session?.perfis?.includes("SUPER_ADMIN") ?? false;

  const [acao, setAcao] = useState("");
  const [entidade, setEntidade] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [page, setPage] = useState(1);

  const filtros: AuditoriaFiltros = useMemo(
    () => ({
      ...(acao ? { acao } : {}),
      ...(entidade ? { entidade } : {}),
      ...(de ? { de } : {}),
      ...(ate ? { ate } : {}),
      page,
      perPage: PER_PAGE,
    }),
    [acao, entidade, de, ate, page],
  );

  const facetas = useAuditoriaFacetas();
  const { data, isLoading, error } = useAuditoria(filtros);

  // Baixa o CSV pelo fetch autenticado (o link direto não carrega o token).
  const token = session?.accessToken;
  const [baixando, setBaixando] = useState(false);
  async function baixarCsv() {
    setBaixando(true);
    try {
      const res = await fetch(urlExportAuditoria({ ...filtros, page: undefined, perPage: undefined }), {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error(`Falha ao exportar (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "auditoria-ifp.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // erro silencioso aqui não é ideal; o estado de erro abaixo cobre a listagem
    } finally {
      setBaixando(false);
    }
  }

  if (!ehAdmin) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Alerta tipo="erro">A trilha de auditoria é exclusiva do Super Admin.</Alerta>
      </main>
    );
  }

  const total = data?.pagination.total ?? 0;
  const totalPages = data?.pagination.totalPages ?? 1;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader
        titulo="Trilha de auditoria"
        descricao="Quem fez o quê, quando — registro LGPD de acessos e alterações de dados sensíveis."
        acoes={
          <Botao variante="outline" onClick={baixarCsv} carregando={baixando}>
            <Download className="h-4 w-4" /> Exportar CSV
          </Botao>
        }
      />

      <Card className="mb-6">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
          <Filter className="h-4 w-4 text-primary" /> Filtros
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Campo label="Ação" htmlFor="f-acao">
            <Select
              id="f-acao"
              value={acao}
              onChange={(e) => {
                setAcao(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todas</option>
              {(facetas.data?.acoes ?? []).map((a) => (
                <option key={a} value={a}>
                  {ACAO_AUDITORIA_LABEL[a] ?? a}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo label="Entidade" htmlFor="f-entidade">
            <Select
              id="f-entidade"
              value={entidade}
              onChange={(e) => {
                setEntidade(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todas</option>
              {(facetas.data?.entidades ?? []).map((en) => (
                <option key={en} value={en}>
                  {en}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo label="De" htmlFor="f-de">
            <Input
              id="f-de"
              type="date"
              value={de}
              onChange={(e) => {
                setDe(e.target.value);
                setPage(1);
              }}
            />
          </Campo>
          <Campo label="Até" htmlFor="f-ate">
            <Input
              id="f-ate"
              type="date"
              value={ate}
              onChange={(e) => {
                setAte(e.target.value);
                setPage(1);
              }}
            />
          </Campo>
        </div>
      </Card>

      {isLoading ? <Spinner label="Carregando trilha..." /> : null}
      {error ? <Alerta tipo="erro">{(error as Error).message}</Alerta> : null}

      {data ? (
        <>
          <p className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4" /> {total} evento(s)
          </p>

          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">Data/hora</th>
                  <th className="px-4 py-3 font-semibold">Ator</th>
                  <th className="px-4 py-3 font-semibold">Ação</th>
                  <th className="px-4 py-3 font-semibold">Entidade</th>
                  <th className="px-4 py-3 font-semibold">Registro</th>
                  <th className="px-4 py-3 font-semibold">IP</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((l) => (
                  <tr key={l.id} className="border-b border-border/60 last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted-foreground">
                      {dataHora(l.criadoEm)}
                    </td>
                    <td className="px-4 py-3">
                      {l.ator ? (
                        <span title={l.ator.email} className="font-medium text-foreground">
                          {l.ator.nome}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">(sistema)</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Pill tom={ACAO_TOM[l.acao] ?? "neutro"}>
                        {ACAO_AUDITORIA_LABEL[l.acao] ?? l.acao}
                      </Pill>
                    </td>
                    <td className="px-4 py-3 text-foreground">{l.entidade}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {l.entidadeId ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {l.ip ?? "—"}
                    </td>
                  </tr>
                ))}
                {data.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Nenhum evento para os filtros selecionados.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </Card>

          {totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-between text-sm">
              <Botao
                variante="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Botao>
              <span className="text-muted-foreground">
                Página {page} de {totalPages}
              </span>
              <Botao
                variante="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Próxima
              </Botao>
            </div>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
