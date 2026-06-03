import { redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { podeGerenciarEspecialidade } from "@/lib/medico/rbac";
import { db } from "@/lib/db";
import { MedicoShell, MedicoHeader } from "@/components/medico/medico-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { criarEspecialidadeAction, toggleEspecialidadeAction } from "./actions";

export default async function EspecialidadesPage() {
  const session = await auth();
  if (!session) redirect("/medico/login" as Route);
  if (!canAccessUnidade(session, "medico")) redirect("/" as Route);
  if (!podeGerenciarEspecialidade(session)) redirect("/medico" as Route);

  const lista = await db.especialidade.findMany({
    orderBy: [{ ativa: "desc" }, { nome: "asc" }],
    include: { _count: { select: { profissionais: true } } },
  });

  const ativas = lista.filter((e) => e.ativa).length;

  return (
    <MedicoShell session={session}>
      <MedicoHeader
        eyebrow="Configuração"
        titulo="Especialidades"
        descricao="O catálogo de especialidades atendidas. A cor de cada uma vira a linguagem visual da agenda."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
        {/* Formulário de criação — coluna fixa à esquerda */}
        <Card accent="medico" className="h-fit">
          <h2 className="t-h3">Nova especialidade</h2>
          <p className="text-3 mt-1 mb-5 text-xs">
            {ativas} ativas · {lista.length} no total
          </p>
          <form action={criarEspecialidadeAction}>
            <label className="field-group">
              <span className="label">Nome</span>
              <input name="nome" required placeholder="Ex: Cardiologia" className="input" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="field-group">
                <span className="label">Duração (min)</span>
                <input
                  name="duracaoPadraoMin"
                  type="number"
                  required
                  min={5}
                  step={5}
                  defaultValue={30}
                  className="input"
                />
              </label>
              <label className="field-group">
                <span className="label">Cor</span>
                <input
                  name="corDestaque"
                  type="color"
                  required
                  defaultValue="#007571"
                  className="input h-[38px] cursor-pointer px-1"
                />
              </label>
            </div>
            <button type="submit" className="btn btn-primary btn-block">
              Adicionar especialidade
            </button>
          </form>
        </Card>

        {/* Lista — grid de chips coloridos */}
        <div className="grid gap-3 sm:grid-cols-2">
          {lista.map((esp) => (
            <div
              key={esp.id}
              className="group relative flex flex-col rounded-[var(--r-lg)] border bg-[var(--surface)] p-4 shadow-[var(--shadow)] transition hover:border-[var(--line-strong)] hover:shadow-[var(--shadow-pop)]"
              style={{
                borderColor: "var(--line)",
                borderLeft: `4px solid ${esp.corDestaque}`,
                opacity: esp.ativa ? 1 : 0.55,
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span
                    className="h-7 w-7 shrink-0 rounded-full"
                    style={{ background: esp.corDestaque }}
                    aria-hidden
                  />
                  <div>
                    <p className="font-bold">{esp.nome}</p>
                    <p className="text-3 text-xs">
                      {esp.duracaoPadraoMin} min · {esp._count.profissionais}{" "}
                      {esp._count.profissionais === 1 ? "profissional" : "profissionais"}
                    </p>
                  </div>
                </div>
                {!esp.ativa && <Badge variant="default">Inativa</Badge>}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="mono text-3 text-[11px]">{esp.corDestaque}</span>
                <form action={toggleEspecialidadeAction}>
                  <input type="hidden" name="id" value={esp.id} />
                  <button
                    type="submit"
                    className="text-accent text-xs font-semibold underline-offset-2 hover:underline"
                  >
                    {esp.ativa ? "Desativar" : "Reativar"}
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </div>
    </MedicoShell>
  );
}
