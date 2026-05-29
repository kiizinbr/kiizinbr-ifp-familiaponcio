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
    <ol className="mb-8 flex items-center gap-2">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className="grid h-7 w-7 place-items-center rounded-full text-xs font-bold transition"
              style={
                active
                  ? { background: "rgb(var(--ifp-teal-700))", color: "#fff" }
                  : done
                    ? { background: "rgb(var(--ifp-teal-500))", color: "#fff" }
                    : { background: "rgb(var(--ifp-surface-100))", color: "rgb(var(--ifp-muted))" }
              }
            >
              {done ? "✓" : n}
            </span>
            <span
              className="text-sm font-semibold"
              style={{ color: active ? "rgb(var(--ifp-ink))" : "rgb(var(--ifp-muted))" }}
            >
              {label}
            </span>
            {n < STEPS.length && <span className="mx-1 text-[rgb(var(--ifp-surface-200))]">—</span>}
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
    erro?: string;
  }>;
}) {
  const session = await auth();
  if (!session) redirect("/medico/login" as Route);
  if (!canAccessUnidade(session, "medico")) redirect("/" as Route);
  if (!podeMarcarConsulta(session)) redirect("/medico" as Route);

  const sp = await searchParams;
  const inputCls =
    "w-full rounded-[var(--ifp-radius-sm)] border px-3 py-2 text-sm focus:border-[rgb(var(--ifp-teal-700))] focus:outline-none";

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
          <p className="mb-3 text-sm font-semibold" style={{ color: "rgb(var(--ifp-ink))" }}>
            Quem será atendido?
          </p>
          <form method="get" className="flex gap-2">
            <input
              name="q"
              defaultValue={sp.q ?? ""}
              autoFocus
              placeholder="Buscar por nome, CPF ou telefone"
              className={inputCls}
              style={{ borderColor: "rgb(var(--ifp-surface-200))" }}
            />
            <button
              type="submit"
              className="shrink-0 rounded-[var(--ifp-radius-md)] px-4 text-sm font-bold text-white"
              style={{ backgroundColor: "rgb(var(--ifp-teal-700))" }}
            >
              Buscar
            </button>
          </form>

          {sp.q && matches.length === 0 && (
            <p className="mt-4 text-sm" style={{ color: "rgb(var(--ifp-muted))" }}>
              Ninguém encontrado para “{sp.q}”.{" "}
              <Link
                href={"/app/cidadaos/novo" as Route}
                className="underline"
                style={{ color: "rgb(var(--ifp-teal-700))" }}
              >
                Cadastrar novo cidadão
              </Link>
            </p>
          )}

          {matches.length > 0 && (
            <ul className="mt-4 divide-y" style={{ borderColor: "rgb(var(--ifp-surface-200))" }}>
              {matches.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/medico/consultas/nova?cidadaoId=${c.id}` as Route}
                    className="flex items-center justify-between gap-3 py-3 transition hover:bg-[rgb(var(--ifp-surface-50))]"
                  >
                    <span className="font-medium" style={{ color: "rgb(var(--ifp-ink))" }}>
                      {c.nomeCompleto}
                    </span>
                    <span className="font-mono text-xs" style={{ color: "rgb(var(--ifp-muted))" }}>
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
        <p className="mb-3 text-sm font-semibold" style={{ color: "rgb(var(--ifp-ink))" }}>
          Qual especialidade?
        </p>
        <div className="grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-3">
          {especialidades.map((e) => (
            <Link
              key={e.id}
              href={
                `/medico/consultas/nova?cidadaoId=${cidadao.id}&especialidadeId=${e.id}` as Route
              }
              className="group rounded-[var(--ifp-radius-lg)] border bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-[var(--ifp-shadow-md)]"
              style={{
                borderColor: "rgb(var(--ifp-surface-200))",
                borderLeft: `4px solid ${e.corDestaque}`,
              }}
            >
              <span className="block h-6 w-6 rounded-full" style={{ background: e.corDestaque }} />
              <p className="mt-3 font-bold" style={{ color: "rgb(var(--ifp-ink))" }}>
                {e.nome}
              </p>
              <p className="text-xs" style={{ color: "rgb(var(--ifp-muted))" }}>
                {e.duracaoPadraoMin} min
              </p>
            </Link>
          ))}
        </div>
        <Link
          href={`/medico/consultas/nova` as Route}
          className="mt-6 inline-block text-sm font-semibold"
          style={{ color: "rgb(var(--ifp-muted))" }}
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
        eyebrow={`${cidadao.nomeCompleto} · ${especialidade.nome}`}
        titulo="Marcar consulta"
      />
      <Stepper current={3} />

      {sp.erro === "slot_indisponivel" && (
        <div
          className="mb-4 rounded-[var(--ifp-radius-md)] border px-4 py-3 text-sm"
          style={{
            borderColor: "rgb(var(--ifp-danger))",
            background: "rgb(var(--ifp-danger) / 0.08)",
            color: "rgb(var(--ifp-danger))",
          }}
        >
          Esse horário acabou de ser reservado por outra pessoa. Escolha outro abaixo.
        </div>
      )}

      {slots.length === 0 ? (
        <Card>
          <p style={{ color: "rgb(var(--ifp-muted))" }}>
            Nenhum horário disponível para {especialidade.nome} nos próximos dias.
          </p>
        </Card>
      ) : (
        <div className="space-y-5">
          {[...porDia.entries()].map(([dia, slotsDoDia]) => (
            <Card key={dia}>
              <p
                className="mb-3 text-sm font-bold capitalize"
                style={{ color: "rgb(var(--ifp-teal-700))" }}
              >
                {dia}
              </p>
              <div className="flex flex-wrap gap-2">
                {slotsDoDia.map((s) => (
                  <form key={s.id} action={reservarConsultaAction}>
                    <input type="hidden" name="slotId" value={s.id} />
                    <input type="hidden" name="cidadaoId" value={cidadao.id} />
                    <input type="hidden" name="profissionalId" value={s.profissionalId} />
                    <input type="hidden" name="especialidadeId" value={especialidade.id} />
                    <button
                      type="submit"
                      className="rounded-[var(--ifp-radius-md)] border px-3 py-2 text-left transition hover:border-[rgb(var(--ifp-teal-700))] hover:bg-[rgb(var(--ifp-surface-50))]"
                      style={{ borderColor: "rgb(var(--ifp-surface-200))" }}
                      title={`Reservar ${s.dataHoraInicio.toLocaleTimeString("pt-BR")} com ${s.profissional.nomeExibicao}`}
                    >
                      <span
                        className="block text-sm font-bold tabular-nums"
                        style={{ color: "rgb(var(--ifp-ink))" }}
                      >
                        {s.dataHoraInicio.toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span
                        className="block text-[11px]"
                        style={{ color: "rgb(var(--ifp-muted))" }}
                      >
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

      <Link
        href={`/medico/consultas/nova?cidadaoId=${cidadao.id}` as Route}
        className="mt-6 inline-block text-sm font-semibold"
        style={{ color: "rgb(var(--ifp-muted))" }}
      >
        ← Trocar especialidade
      </Link>
    </MedicoShell>
  );
}
