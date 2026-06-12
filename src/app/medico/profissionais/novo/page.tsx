import { redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { podeGerenciarProfissional } from "@/lib/medico/rbac";
import { db } from "@/lib/db";
import { MedicoShell, MedicoHeader } from "@/components/medico/medico-shell";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { criarProfissionalAction } from "../actions";

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
          <div className="text-3 text-sm">
            <p className="font-semibold" style={{ color: "var(--text)" }}>
              Nenhum usuário elegível.
            </p>
            <p className="mt-2">
              Pra virar profissional, o usuário precisa ter o papel{" "}
              <code className="chip chip-mono">profissional</code> na unidade médica. Crie/ajuste em{" "}
              <Link
                href={"/admin/users" as Route}
                className="underline"
                style={{ color: "var(--accent)" }}
              >
                Admin · Usuários
              </Link>
              .
            </p>
          </div>
        ) : (
          <form action={criarProfissionalAction} className="space-y-5">
            <label className="field-group">
              <span className="label">Usuário vinculado</span>
              <select name="userId" required defaultValue="" className="select">
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

            <label className="field-group">
              <span className="label">Nome de exibição</span>
              <input name="nomeExibicao" required placeholder="Dr. João Silva" className="input" />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="field-group">
                <span className="label">Conselho</span>
                <input name="conselho" required placeholder="CRM-RJ" className="input" />
              </label>
              <label className="field-group">
                <span className="label">Nº conselho</span>
                <input name="nroConselho" required placeholder="12345" className="input" />
              </label>
            </div>

            <fieldset>
              <legend className="label">Especialidades (1 ou mais)</legend>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {especialidades.map((e) => (
                  <label
                    key={e.id}
                    className="flex cursor-pointer items-center gap-2 px-2.5 py-2 text-sm transition hover:[border-color:var(--line-strong)]"
                    style={{
                      border: "1px solid var(--line)",
                      borderRadius: "var(--r-sm)",
                      background: "var(--surface)",
                      color: "var(--text)",
                    }}
                  >
                    <input
                      type="checkbox"
                      name="especialidadeIds"
                      value={e.id}
                      style={{ accentColor: "var(--accent)" }}
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

            <label className="field-group">
              <span className="label">Bio curta (opcional)</span>
              <textarea name="bio" rows={3} className="textarea" />
            </label>

            <div className="flex items-center gap-3 pt-1">
              <SubmitButton pendingLabel="Cadastrando…">Cadastrar profissional</SubmitButton>
              <Link
                href={"/medico/profissionais" as Route}
                className="text-3 text-sm font-semibold"
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
