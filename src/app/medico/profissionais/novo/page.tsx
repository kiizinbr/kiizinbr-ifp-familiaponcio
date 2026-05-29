import { redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { podeGerenciarProfissional } from "@/lib/medico/rbac";
import { db } from "@/lib/db";
import { MedicoShell, MedicoHeader } from "@/components/medico/medico-shell";
import { Card } from "@/components/ui/card";
import { criarProfissionalAction } from "../actions";

const fieldCls =
  "mt-1 w-full rounded-[var(--ifp-radius-sm)] border px-3 py-2 text-sm focus:border-[rgb(var(--ifp-teal-700))] focus:outline-none";
const labelCls = "text-xs font-medium";

export default async function NovoProfissionalPage() {
  const session = await auth();
  if (!session) redirect("/medico/login" as Route);
  if (!canAccessUnidade(session, "medico")) redirect("/" as Route);
  if (!podeGerenciarProfissional(session)) redirect("/medico/profissionais" as Route);

  const usersElegiveis = await db.user.findMany({
    where: {
      AND: [
        { profissional: null },
        { userRoles: { some: { role: { name: "profissional" }, unitScope: "medico" } } },
      ],
    },
    orderBy: { name: "asc" },
  });

  const especialidades = await db.especialidade.findMany({
    where: { ativa: true },
    orderBy: { nome: "asc" },
  });

  return (
    <MedicoShell session={session}>
      <MedicoHeader eyebrow="Equipe · novo cadastro" titulo="Novo profissional" />

      <Card accent="medico" className="max-w-2xl">
        {usersElegiveis.length === 0 ? (
          <div className="text-sm" style={{ color: "rgb(var(--ifp-muted))" }}>
            <p className="font-semibold" style={{ color: "rgb(var(--ifp-ink))" }}>
              Nenhum usuário elegível.
            </p>
            <p className="mt-2">
              Pra virar profissional, o usuário precisa ter o papel{" "}
              <code className="rounded bg-[rgb(var(--ifp-surface-100))] px-1">profissional</code> na
              unidade médica. Crie/ajuste em{" "}
              <Link
                href={"/admin/users" as Route}
                className="underline"
                style={{ color: "rgb(var(--ifp-teal-700))" }}
              >
                Admin · Usuários
              </Link>
              .
            </p>
          </div>
        ) : (
          <form action={criarProfissionalAction} className="space-y-5">
            <label className="block">
              <span className={labelCls} style={{ color: "rgb(var(--ifp-muted))" }}>
                Usuário vinculado
              </span>
              <select
                name="userId"
                required
                defaultValue=""
                className={fieldCls}
                style={{ borderColor: "rgb(var(--ifp-surface-200))" }}
              >
                <option value="" disabled>
                  — escolha um usuário —
                </option>
                {usersElegiveis.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name ?? u.email} ({u.email})
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className={labelCls} style={{ color: "rgb(var(--ifp-muted))" }}>
                Nome de exibição
              </span>
              <input
                name="nomeExibicao"
                required
                placeholder="Dr. João Silva"
                className={fieldCls}
                style={{ borderColor: "rgb(var(--ifp-surface-200))" }}
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={labelCls} style={{ color: "rgb(var(--ifp-muted))" }}>
                  Conselho
                </span>
                <input
                  name="conselho"
                  required
                  placeholder="CRM-RJ"
                  className={fieldCls}
                  style={{ borderColor: "rgb(var(--ifp-surface-200))" }}
                />
              </label>
              <label className="block">
                <span className={labelCls} style={{ color: "rgb(var(--ifp-muted))" }}>
                  Nº conselho
                </span>
                <input
                  name="nroConselho"
                  required
                  placeholder="12345"
                  className={fieldCls}
                  style={{ borderColor: "rgb(var(--ifp-surface-200))" }}
                />
              </label>
            </div>

            <fieldset>
              <legend className={labelCls} style={{ color: "rgb(var(--ifp-muted))" }}>
                Especialidades (1 ou mais)
              </legend>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {especialidades.map((e) => (
                  <label
                    key={e.id}
                    className="flex cursor-pointer items-center gap-2 rounded-[var(--ifp-radius-sm)] border px-2.5 py-2 text-sm transition hover:bg-[rgb(var(--ifp-surface-50))]"
                    style={{ borderColor: "rgb(var(--ifp-surface-200))" }}
                  >
                    <input
                      type="checkbox"
                      name="especialidadeIds"
                      value={e.id}
                      className="accent-[rgb(var(--ifp-teal-700))]"
                    />
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: e.corDestaque }}
                    />
                    <span className="truncate">{e.nome}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="block">
              <span className={labelCls} style={{ color: "rgb(var(--ifp-muted))" }}>
                Bio curta (opcional)
              </span>
              <textarea
                name="bio"
                rows={3}
                className={fieldCls}
                style={{ borderColor: "rgb(var(--ifp-surface-200))" }}
              />
            </label>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                className="rounded-[var(--ifp-radius-md)] px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
                style={{ backgroundColor: "rgb(var(--ifp-teal-700))" }}
              >
                Cadastrar profissional
              </button>
              <Link
                href={"/medico/profissionais" as Route}
                className="text-sm font-semibold"
                style={{ color: "rgb(var(--ifp-muted))" }}
              >
                Cancelar
              </Link>
            </div>
          </form>
        )}
      </Card>
    </MedicoShell>
  );
}
