import { redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { podeMarcarConsulta } from "@/lib/medico/rbac";
import { db } from "@/lib/db";
import { MedicoShell, MedicoHeader } from "@/components/medico/medico-shell";
import { Card } from "@/components/ui/card";
import { formatCpf } from "@/lib/cpf";
import { reservarConsultaAction } from "./actions";

const STEPS = ["Cidadão", "Especialidade", "Horário", "Confirmar"] as const;

function Stepper({ current }: { current: number }) {
  return (
    <ol className="stepper mb-8">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        const cls = ["step", done ? "done" : "", active ? "active" : ""].filter(Boolean).join(" ");
        return (
          <li key={label} className={cls}>
            <span className="num">{done ? "✓" : n}</span>
            <span className="lbl">{label}</span>
            {n < STEPS.length && <span className="bar" />}
          </li>
        );
      })}
    </ol>
  );
}

export default async function NovaConsultaPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    cidadaoId?: string;
    especialidadeId?: string;
    encaminhamentoId?: string;
    erro?: string;
  }>;
}) {
  const session = await auth();
  if (!session) redirect("/medico/login" as Route);
  if (!canAccessUnidade(session, "medico")) redirect("/" as Route);
  if (!podeMarcarConsulta(session)) redirect("/medico" as Route);

  const sp = await searchParams;

  // Atalho da fila de encaminhamento: se vier um encaminhamento pendente,
  // pré-preenche e TRAVA cidadão + especialidade (pula os passos 1–2).
  let encaminhamentoId = sp.encaminhamentoId;
  if (encaminhamentoId) {
    const enc = await db.encaminhamento.findUnique({ where: { id: encaminhamentoId } });
    if (enc && enc.status === "aguardando_agendamento") {
      sp.cidadaoId = enc.cidadaoId;
      sp.especialidadeId = enc.especialidadeId;
    } else {
      encaminhamentoId = undefined; // já agendado/cancelado/inexistente → fluxo normal
    }
  }

  // ---- Step 1: buscar cidadão ----
  if (!sp.cidadaoId) {
    // CPF só entra no OR se a query tiver dígitos: senão `contains: ""` vira
    // LIKE '%%' e casa TODOS os registros, quebrando a busca por nome.
    const digits = sp.q?.replace(/\D/g, "") ?? "";
    const matches = sp.q
      ? await db.cidadao.findMany({
          where: {
            deletedAt: null, // soft-delete real (NÃO existe status "deletado")
            OR: [
              { nomeCompleto: { contains: sp.q, mode: "insensitive" } },
              { telefonePrincipal: { contains: sp.q } },
              ...(digits ? [{ cpf: { contains: digits } }] : []),
            ],
          },
          take: 8,
          orderBy: { nomeCompleto: "asc" },
        })
      : [];

    return (
      <MedicoShell session={session}>
        <MedicoHeader eyebrow="Nova consulta" titulo="Marcar consulta" />
        <Stepper current={1} />
        <Card accent="medico" className="max-w-2xl">
          <p className="mb-3 text-sm font-semibold" style={{ color: "var(--text)" }}>
            Quem será atendido?
          </p>
          <form method="get" className="flex gap-2">
            <input
              name="q"
              defaultValue={sp.q ?? ""}
              autoFocus
              placeholder="Buscar por nome, CPF ou telefone"
              className="input"
            />
            <button type="submit" className="btn btn-primary shrink-0">
              Buscar
            </button>
          </form>

          {sp.q && matches.length === 0 && (
            <p className="mt-4 text-sm" style={{ color: "var(--text-3)" }}>
              Ninguém encontrado para “{sp.q}”.{" "}
              <Link
                href={"/app/cidadaos/novo" as Route}
                className="underline"
                style={{ color: "var(--accent)" }}
              >
                Cadastrar novo cidadão
              </Link>
            </p>
          )}

          {matches.length > 0 && (
            <ul className="mt-4 divide-y" style={{ borderColor: "var(--line)" }}>
              {matches.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/medico/consultas/nova?cidadaoId=${c.id}` as Route}
                    className="flex items-center justify-between gap-3 py-3 transition hover:bg-[var(--surface-2)]"
                  >
                    <span className="font-medium" style={{ color: "var(--text)" }}>
                      {c.nomeCompleto}
                    </span>
                    <span className="mono text-xs" style={{ color: "var(--text-3)" }}>
                      {formatCpf(c.cpf)} · {c.telefonePrincipal}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </MedicoShell>
    );
  }

  const cidadao = await db.cidadao.findUniqueOrThrow({ where: { id: sp.cidadaoId } });

  // ---- Step 2: especialidade ----
  if (!sp.especialidadeId) {
    const especialidades = await db.especialidade.findMany({
      where: { ativa: true },
      orderBy: { nome: "asc" },
    });
    return (
      <MedicoShell session={session}>
        <MedicoHeader eyebrow={`Cidadão · ${cidadao.nomeCompleto}`} titulo="Marcar consulta" />
        <Stepper current={2} />
        <p className="mb-3 text-sm font-semibold" style={{ color: "var(--text)" }}>
          Qual especialidade?
        </p>
        <div className="grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-3">
          {especialidades.map((e) => (
            <Link
              key={e.id}
              href={
                `/medico/consultas/nova?cidadaoId=${cidadao.id}&especialidadeId=${e.id}` as Route
              }
              className="group rounded-[var(--r-lg)] border p-4 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow)]"
              style={{
                background: "var(--surface)",
                borderColor: "var(--line)",
                borderLeft: `4px solid ${e.corDestaque}`,
              }}
            >
              <span className="block h-6 w-6 rounded-full" style={{ background: e.corDestaque }} />
              <p className="mt-3 font-bold" style={{ color: "var(--text)" }}>
                {e.nome}
              </p>
              <p className="text-xs" style={{ color: "var(--text-3)" }}>
                {e.duracaoPadraoMin} min
              </p>
            </Link>
          ))}
        </div>
        <Link
          href={`/medico/consultas/nova` as Route}
          className="mt-6 inline-block text-sm font-semibold"
          style={{ color: "var(--text-3)" }}
        >
          ← Trocar cidadão
        </Link>
      </MedicoShell>
    );
  }

  const especialidade = await db.especialidade.findUniqueOrThrow({
    where: { id: sp.especialidadeId },
  });

  // ---- Step 3+4: escolher slot (e confirmar inline) ----
  const slots = await db.slot.findMany({
    where: {
      especialidadeId: sp.especialidadeId,
      status: "disponivel",
      dataHoraInicio: { gte: new Date() },
    },
    include: { profissional: true },
    orderBy: { dataHoraInicio: "asc" },
    take: 24,
  });

  // agrupa por dia
  const porDia = new Map<string, typeof slots>();
  for (const s of slots) {
    const k = s.dataHoraInicio.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    });
    if (!porDia.has(k)) porDia.set(k, []);
    porDia.get(k)!.push(s);
  }

  return (
    <MedicoShell session={session}>
      <MedicoHeader
        eyebrow={
          encaminhamentoId
            ? `Encaminhamento · ${cidadao.nomeCompleto} · ${especialidade.nome}`
            : `${cidadao.nomeCompleto} · ${especialidade.nome}`
        }
        titulo="Marcar consulta"
      />
      <Stepper current={3} />

      {sp.erro === "slot_indisponivel" && (
        <div
          className="mb-4 rounded-[var(--r-md)] border px-4 py-3 text-sm"
          style={{
            borderColor: "var(--danger)",
            background: "var(--danger-soft)",
            color: "var(--danger)",
          }}
        >
          Esse horário acabou de ser reservado por outra pessoa. Escolha outro abaixo.
        </div>
      )}

      {slots.length === 0 ? (
        <Card>
          <p style={{ color: "var(--text-3)" }}>
            Nenhum horário disponível para {especialidade.nome} nos próximos dias.
          </p>
        </Card>
      ) : (
        <div className="space-y-5">
          {[...porDia.entries()].map(([dia, slotsDoDia]) => (
            <Card key={dia}>
              <p className="mb-3 text-sm font-bold capitalize" style={{ color: "var(--accent)" }}>
                {dia}
              </p>
              <div className="flex flex-wrap gap-2">
                {slotsDoDia.map((s) => (
                  <form key={s.id} action={reservarConsultaAction}>
                    <input type="hidden" name="slotId" value={s.id} />
                    <input type="hidden" name="cidadaoId" value={cidadao.id} />
                    <input type="hidden" name="profissionalId" value={s.profissionalId} />
                    <input type="hidden" name="especialidadeId" value={especialidade.id} />
                    {encaminhamentoId ? (
                      <input type="hidden" name="encaminhamentoId" value={encaminhamentoId} />
                    ) : null}
                    <button
                      type="submit"
                      className="rounded-[var(--r-md)] border px-3 py-2 text-left transition hover:border-[var(--accent)] hover:bg-[var(--surface-2)]"
                      style={{ borderColor: "var(--line)" }}
                      title={`Reservar ${s.dataHoraInicio.toLocaleTimeString("pt-BR")} com ${s.profissional.nomeExibicao}`}
                    >
                      <span
                        className="mono block text-sm font-bold tabular-nums"
                        style={{ color: "var(--text)" }}
                      >
                        {s.dataHoraInicio.toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="block text-[11px]" style={{ color: "var(--text-3)" }}>
                        {s.profissional.nomeExibicao}
                      </span>
                    </button>
                  </form>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {!encaminhamentoId && (
        <Link
          href={`/medico/consultas/nova?cidadaoId=${cidadao.id}` as Route}
          className="mt-6 inline-block text-sm font-semibold"
          style={{ color: "var(--text-3)" }}
        >
          ← Trocar especialidade
        </Link>
      )}
    </MedicoShell>
  );
}
