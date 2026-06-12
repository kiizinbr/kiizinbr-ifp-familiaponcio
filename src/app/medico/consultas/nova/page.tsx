import { redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { podeMarcarConsulta } from "@/lib/medico/rbac";
import { db } from "@/lib/db";
import { MedicoShell, MedicoHeader } from "@/components/medico/medico-shell";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatCpf } from "@/lib/cpf";
import { reservarConsultaAction, criarSlotAdHocAction, atenderAgoraAction } from "./actions";

const INPUT_CLS = "rounded-[var(--r-md)] border px-2 py-1.5 text-sm";
const INPUT_STYLE = {
  borderColor: "var(--line)",
  background: "var(--surface)",
  color: "var(--text)",
} as const;

function ProfissionalSelect({
  profissionais,
}: {
  profissionais: { id: string; nomeExibicao: string }[];
}) {
  return (
    <label className="flex flex-col gap-1 text-[12px]" style={{ color: "var(--text-3)" }}>
      Profissional
      <select name="profissionalId" required className={INPUT_CLS} style={INPUT_STYLE}>
        {profissionais.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nomeExibicao}
          </option>
        ))}
      </select>
    </label>
  );
}

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
            <SubmitButton className="shrink-0" pendingLabel="Buscando…">
              Buscar
            </SubmitButton>
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

  // Profissionais que atendem esta especialidade — alimentam o encaixe/walk-in (F2).
  const profissionais = await db.profissional.findMany({
    where: { ativo: true, especialidades: { some: { especialidadeId: sp.especialidadeId } } },
    orderBy: { nomeExibicao: "asc" },
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

      {sp.erro && (
        <div
          className="mb-4 rounded-[var(--r-md)] border px-4 py-3 text-sm"
          style={{
            borderColor: "var(--danger)",
            background: "var(--danger-soft)",
            color: "var(--danger)",
          }}
        >
          {sp.erro === "slot_indisponivel"
            ? "Esse horário acabou de ser reservado por outra pessoa. Escolha outro abaixo."
            : sp.erro === "slot_existe"
              ? "Já existe um horário para esse profissional nesse instante. Escolha outro horário."
              : sp.erro === "adhoc_invalido"
                ? "Dados do encaixe inválidos. Confira profissional, data/hora e duração."
                : "Não foi possível concluir a ação. Tente novamente."}
        </div>
      )}

      {slots.length === 0 ? (
        <Card>
          <p style={{ color: "var(--text-3)" }}>
            Nenhum horário pré-gerado para {especialidade.nome}. Use o <strong>encaixe</strong>{" "}
            abaixo para criar um horário sob demanda.
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
                    <SubmitButton
                      variant="ghost"
                      pendingLabel="Reservando…"
                      className="rounded-[var(--r-md)] border text-left transition hover:border-[var(--accent)] hover:bg-[var(--surface-2)]"
                      style={{
                        display: "block",
                        padding: "8px 12px",
                        fontWeight: 400,
                        lineHeight: 1.4,
                        borderColor: "var(--line)",
                      }}
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
                    </SubmitButton>
                  </form>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-6">
        <Card>
          <p className="mb-1 text-sm font-bold" style={{ color: "var(--accent)" }}>
            Encaixe / walk-in
          </p>
          <p className="mb-4 text-[13px]" style={{ color: "var(--text-3)" }}>
            Sem horário na grade? Crie um sob demanda — escolha o profissional e o instante, ou
            atenda agora por ordem de chegada.
          </p>
          {profissionais.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-3)" }}>
              Nenhum profissional cadastrado para {especialidade.nome}.
            </p>
          ) : (
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <form action={criarSlotAdHocAction} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="cidadaoId" value={cidadao.id} />
                <input type="hidden" name="especialidadeId" value={especialidade.id} />
                <ProfissionalSelect profissionais={profissionais} />
                <label
                  className="flex flex-col gap-1 text-[12px]"
                  style={{ color: "var(--text-3)" }}
                >
                  Data e hora
                  <input
                    type="datetime-local"
                    name="dataHoraInicio"
                    required
                    className={INPUT_CLS}
                    style={INPUT_STYLE}
                  />
                </label>
                <label
                  className="flex flex-col gap-1 text-[12px]"
                  style={{ color: "var(--text-3)" }}
                >
                  Duração (min)
                  <input
                    type="number"
                    name="duracaoMin"
                    defaultValue={30}
                    min={5}
                    max={240}
                    className={`w-20 ${INPUT_CLS}`}
                    style={INPUT_STYLE}
                  />
                </label>
                <SubmitButton>Criar horário e marcar</SubmitButton>
              </form>
              <form action={atenderAgoraAction} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="cidadaoId" value={cidadao.id} />
                <input type="hidden" name="especialidadeId" value={especialidade.id} />
                <ProfissionalSelect profissionais={profissionais} />
                <SubmitButton>Atender agora</SubmitButton>
              </form>
            </div>
          )}
        </Card>
      </div>

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
