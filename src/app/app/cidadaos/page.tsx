import { redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { listCidadaos, calcularIdade, type CidadaoStatus } from "@/lib/cidadao";
import { statusDisplay, type StatusTone } from "@/lib/cidadao-status";
import { formatCpf } from "@/lib/cpf";
import { UNIT_SCOPES, type UnitScope } from "@/lib/rbac-types";

const UNIT_LABELS: Record<UnitScope, string> = {
  medico: "Médico",
  capacitacao: "Capacitação",
  esportivo: "Esportivo",
  recreativo: "Recreativo",
};

// Cor de dado: identidade da unidade (preservada do kit, token --u-*).
const UNIT_COLOR: Record<UnitScope, string> = {
  medico: "var(--u-medico)",
  capacitacao: "var(--u-capacitacao)",
  esportivo: "var(--u-esportivo)",
  recreativo: "var(--u-recreativo)",
};

const TONE_VARIANT: Record<StatusTone, "danger" | "warning" | "success" | "default"> = {
  red: "danger",
  amber: "warning",
  emerald: "success",
  slate: "default",
};

type CicloFilter = "rascunho" | "ativo" | "inativo";

interface SearchParams {
  q?: string;
  unidade?: string;
  status?: CidadaoStatus;
  ciclo?: string;
  cursor?: string;
}

const CICLO_VALUES: CicloFilter[] = ["rascunho", "ativo", "inativo"];

export default async function CidadaosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const params = await searchParams;
  const selectedUnits = params.unidade
    ? (params.unidade.split(",").filter((u) => UNIT_SCOPES.includes(u as UnitScope)) as UnitScope[])
    : undefined;

  const ciclo = CICLO_VALUES.includes(params.ciclo as CicloFilter)
    ? (params.ciclo as CicloFilter)
    : undefined;

  const { items, nextCursor } = await listCidadaos(
    {
      search: params.q,
      unitScopes: selectedUnits,
      status: params.status,
      statusCadastro: ciclo,
      cursor: params.cursor,
      limit: 50,
    },
    session,
  );

  const agora = new Date();
  const dataWeekday = agora.toLocaleDateString("pt-BR", { weekday: "long" });
  const dataFull = agora.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <AppShell session={session}>
      <div className="page-head">
        <div>
          <p className="micro" style={{ color: "var(--accent)" }}>
            Instituto Família Pôncio · Pessoas atendidas
          </p>
          <h1 className="t-h1" style={{ color: "var(--text)" }}>
            Cidadãos
          </h1>
          <p style={{ color: "var(--text-3)", fontSize: 13, marginTop: 4 }}>
            {dataWeekday} · {dataFull}
          </p>
        </div>
        <div className="actions">
          <Link href={"/app/cidadaos/novo" as Route} className="btn btn-primary">
            + Novo cidadão
          </Link>
        </div>
      </div>

      <form
        method="get"
        className="card"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          gap: "var(--sp-3)",
          padding: "16px 18px",
          marginBottom: "var(--sp-4)",
        }}
      >
        <div className="field-group" style={{ flex: 1, minWidth: 220, marginBottom: 0 }}>
          <label className="label">Buscar (nome, CPF, telefone)</label>
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Ex: Maria Silva ou 123.456.789-09"
            className="input"
          />
        </div>
        <div className="field-group" style={{ marginBottom: 0 }}>
          <label className="label">Unidade</label>
          <select name="unidade" defaultValue={params.unidade ?? ""} className="select">
            <option value="">Todas</option>
            {UNIT_SCOPES.map((u) => (
              <option key={u} value={u}>
                {UNIT_LABELS[u]}
              </option>
            ))}
          </select>
        </div>
        <div className="field-group" style={{ marginBottom: 0 }}>
          <label className="label">Status</label>
          <select name="status" defaultValue={params.status ?? "ativo"} className="select">
            <option value="ativo">Ativos</option>
            <option value="deletado">Excluídos</option>
            <option value="anonimizado">Anonimizados (LGPD)</option>
          </select>
        </div>
        <div className="field-group" style={{ marginBottom: 0 }}>
          <label className="label">Ciclo</label>
          <select name="ciclo" defaultValue={params.ciclo ?? ""} className="select">
            <option value="">Todos</option>
            <option value="rascunho">Rascunho</option>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </select>
        </div>
        <button type="submit" className="btn btn-secondary">
          Filtrar
        </button>
      </form>

      <p style={{ color: "var(--text-3)", fontSize: 13, margin: "0 0 12px" }}>
        {items.length} {items.length === 1 ? "pessoa encontrada" : "pessoas encontradas"}
      </p>

      {items.length === 0 ? (
        <EmptyState
          titulo="Nenhum cidadão encontrado"
          descricao="Nenhum cidadão corresponde a esses filtros. Ajuste a busca ou cadastre uma nova pessoa."
        />
      ) : (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Nome</th>
                <th>CPF</th>
                <th>Idade</th>
                <th>Telefone</th>
                <th>Unidade</th>
                <th>Família</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => {
                const unit = c.unitIdOrigem as UnitScope;
                const status = statusDisplay(c);
                return (
                  <tr key={c.id}>
                    <td>
                      <Link
                        href={`/app/cidadaos/${c.id}` as Route}
                        className="cell-strong"
                        style={{ color: "var(--text)", textDecoration: "none" }}
                      >
                        {c.nomeCompleto}
                      </Link>
                      {c.nomeSocial && (
                        <div style={{ color: "var(--text-3)", fontSize: 12 }}>
                          Social: {c.nomeSocial}
                        </div>
                      )}
                    </td>
                    <td className="cell-mono">{formatCpf(c.cpf)}</td>
                    <td style={{ color: "var(--text-3)" }}>
                      {calcularIdade(c.dataNascimento)} anos
                    </td>
                    <td style={{ color: "var(--text-3)" }}>{c.telefonePrincipal}</td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          color: "#fff",
                          background: UNIT_COLOR[unit],
                          borderColor: "transparent",
                        }}
                      >
                        {UNIT_LABELS[unit]}
                      </span>
                    </td>
                    <td style={{ color: "var(--text-3)" }}>{c.familia?.nomeReferencia ?? "—"}</td>
                    <td>
                      <Badge variant={TONE_VARIANT[status.tone]}>{status.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {nextCursor && (
        <div style={{ marginTop: "var(--sp-4)", textAlign: "center" }}>
          <Link href={`/app/cidadaos?cursor=${nextCursor}` as Route} className="btn btn-secondary">
            Carregar mais
          </Link>
        </div>
      )}
    </AppShell>
  );
}
