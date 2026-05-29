import { redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
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

const TONE_BADGE: Record<StatusTone, string> = {
  red: "bg-red-100 text-red-700",
  amber: "bg-amber-100 text-amber-700",
  emerald: "bg-emerald-100 text-emerald-700",
  slate: "bg-slate-100 text-[rgb(var(--ifp-muted))]",
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

  return (
    <AppShell session={session}>
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-widest text-[rgb(var(--ifp-muted))] uppercase">
            Pessoas atendidas
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-[rgb(var(--ifp-ink))]">Cidadãos</h1>
          <p className="mt-2 text-sm text-[rgb(var(--ifp-muted))]">
            {items.length} {items.length === 1 ? "pessoa encontrada" : "pessoas encontradas"}
          </p>
        </div>
        <Link
          href={"/app/cidadaos/novo" as Route}
          className="rounded bg-[rgb(var(--ifp-orange-500))] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
        >
          + Novo cidadão
        </Link>
      </header>

      <section className="ifp-card mb-4 p-5">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-xs font-medium text-[rgb(var(--ifp-muted))]">
              Buscar (nome, CPF, telefone)
            </label>
            <input
              type="search"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Ex: Maria Silva ou 123.456.789-09"
              className="w-full rounded border px-3 py-2 text-sm focus:border-[rgb(var(--ifp-orange-500))] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[rgb(var(--ifp-muted))]">
              Unidade
            </label>
            <select
              name="unidade"
              defaultValue={params.unidade ?? ""}
              className="rounded border px-3 py-2 text-sm"
            >
              <option value="">Todas</option>
              {UNIT_SCOPES.map((u) => (
                <option key={u} value={u}>
                  {UNIT_LABELS[u]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[rgb(var(--ifp-muted))]">
              Status
            </label>
            <select
              name="status"
              defaultValue={params.status ?? "ativo"}
              className="rounded border px-3 py-2 text-sm"
            >
              <option value="ativo">Ativos</option>
              <option value="deletado">Excluídos</option>
              <option value="anonimizado">Anonimizados (LGPD)</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[rgb(var(--ifp-muted))]">
              Ciclo
            </label>
            <select
              name="ciclo"
              defaultValue={params.ciclo ?? ""}
              className="rounded border px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              <option value="rascunho">Rascunho</option>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>
          <button
            type="submit"
            className="rounded border border-slate-300 px-4 py-2 text-sm transition hover:bg-slate-50"
          >
            Filtrar
          </button>
        </form>
      </section>

      <section className="ifp-card overflow-hidden">
        {items.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm text-[rgb(var(--ifp-muted))]">
              Nenhum cidadão encontrado com esses filtros.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs tracking-wide text-[rgb(var(--ifp-muted))] uppercase">
              <tr>
                <th className="px-5 py-3 text-left font-medium">Nome</th>
                <th className="px-5 py-3 text-left font-medium">CPF</th>
                <th className="px-5 py-3 text-left font-medium">Idade</th>
                <th className="px-5 py-3 text-left font-medium">Telefone</th>
                <th className="px-5 py-3 text-left font-medium">Unidade</th>
                <th className="px-5 py-3 text-left font-medium">Família</th>
                <th className="px-5 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((c) => {
                const unit = c.unitIdOrigem as UnitScope;
                const status = statusDisplay(c);
                return (
                  <tr key={c.id} className="transition hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link
                        href={`/app/cidadaos/${c.id}` as Route}
                        className="font-medium text-[rgb(var(--ifp-ink))] hover:text-[rgb(var(--ifp-orange-500))]"
                      >
                        {c.nomeCompleto}
                      </Link>
                      {c.nomeSocial && (
                        <p className="text-xs text-[rgb(var(--ifp-muted))]">
                          Social: {c.nomeSocial}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-700">
                      {formatCpf(c.cpf)}
                    </td>
                    <td className="px-5 py-3 text-slate-700">
                      {calcularIdade(c.dataNascimento)} anos
                    </td>
                    <td className="px-5 py-3 text-slate-700">{c.telefonePrincipal}</td>
                    <td className="px-5 py-3">
                      <span
                        className="rounded px-2 py-0.5 text-xs font-medium text-white"
                        style={{ background: `rgb(var(--ifp-filter-${unit}))` }}
                      >
                        {UNIT_LABELS[unit]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-[rgb(var(--ifp-muted))]">
                      {c.familia?.nomeReferencia ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${TONE_BADGE[status.tone]}`}
                      >
                        {status.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {nextCursor && (
        <div className="mt-4 text-center">
          <Link
            href={`/app/cidadaos?cursor=${nextCursor}` as Route}
            className="inline-block rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
          >
            Carregar mais
          </Link>
        </div>
      )}
    </AppShell>
  );
}
