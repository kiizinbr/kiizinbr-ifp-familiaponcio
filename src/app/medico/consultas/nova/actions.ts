"use server";

import { redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import {
  reservarSlot,
  reservarSlotAdHoc,
  SlotIndisponivelError,
  SlotJaExisteError,
} from "@/lib/medico/agenda";
import { reservarConsultaSchema, criarSlotAdHocSchema } from "@/lib/medico/agenda-schema";
import { podeMarcarConsulta } from "@/lib/medico/rbac";
import { logEvent } from "@/lib/audit";
import { db } from "@/lib/db";
import { buscaCidadaoValida, buildBuscaCidadaoWhere } from "@/lib/medico/busca-cidadao";
import {
  novoPacienteSchema,
  novoPacienteParaCidadaoInput,
  type NovoPacienteInput,
} from "@/lib/medico/novo-paciente-schema";
import { createCidadaoAction, type CreateCidadaoResult } from "@/app/app/cidadaos/novo/actions";

export async function reservarConsultaAction(formData: FormData) {
  const session = await auth();
  if (!canAccessUnidade(session, "medico")) throw new Error("Sem permissão");
  if (!podeMarcarConsulta(session)) throw new Error("Sem permissão");

  const slotId = String(formData.get("slotId"));
  const cidadaoId = String(formData.get("cidadaoId"));
  const profissionalId = String(formData.get("profissionalId"));
  const especialidadeId = String(formData.get("especialidadeId"));
  const observacoesAgendamento = String(formData.get("observacoes") ?? "").trim() || undefined;
  const encaminhamentoId = String(formData.get("encaminhamentoId") ?? "").trim() || undefined;

  const ids = reservarConsultaSchema.safeParse({
    slotId,
    cidadaoId,
    profissionalId,
    especialidadeId,
  });
  if (!ids.success) throw new Error("Dados de agendamento inválidos");

  try {
    const consulta = await reservarSlot({
      slotId,
      cidadaoId,
      profissionalId,
      especialidadeId,
      createdBy: session!.user.id,
      observacoesAgendamento,
      origemEncaminhamentoId: encaminhamentoId,
    });
    await logEvent({
      userId: session!.user.id,
      action: "consulta_agendada",
      meta: { consultaId: consulta.id, slotId, cidadaoId },
    });
    if (encaminhamentoId) {
      await logEvent({
        userId: session!.user.id,
        action: "encaminhamento_agendado",
        entityType: "encaminhamento",
        entityId: encaminhamentoId,
        meta: { consultaId: consulta.id },
      });
    }
    redirect(`/medico/consultas/${consulta.id}` as Route);
  } catch (e) {
    if (e instanceof SlotIndisponivelError) {
      const enc = encaminhamentoId ? `&encaminhamentoId=${encaminhamentoId}` : "";
      redirect(
        `/medico/consultas/nova?cidadaoId=${cidadaoId}&especialidadeId=${especialidadeId}${enc}&erro=slot_indisponivel` as Route,
      );
    }
    throw e;
  }
}

/**
 * Cria um slot ad-hoc + reserva (encaixe ou walk-in) e redireciona. Compartilhado pelas
 * duas actions abaixo. Sempre redireciona (sucesso → consulta; SlotJaExisteError → volta
 * ao balcão com aviso). `redirect` lança NEXT_REDIRECT, então o `throw e` no catch o
 * re-propaga (só interceptamos SlotJaExisteError).
 */
async function executarAdHoc(
  userId: string,
  fields: {
    cidadaoId: string;
    profissionalId: string;
    especialidadeId: string;
    dataHoraInicio: Date;
    duracaoMin: number;
  },
): Promise<never> {
  try {
    const consulta = await reservarSlotAdHoc({ ...fields, createdBy: userId });
    await logEvent({
      userId,
      action: "consulta_agendada",
      meta: {
        consultaId: consulta.id,
        slotId: consulta.slotId,
        cidadaoId: fields.cidadaoId,
        adhoc: true,
      },
    });
    redirect(`/medico/consultas/${consulta.id}` as Route);
  } catch (e) {
    if (e instanceof SlotJaExisteError) {
      redirect(
        `/medico/consultas/nova?cidadaoId=${fields.cidadaoId}&especialidadeId=${fields.especialidadeId}&erro=slot_existe` as Route,
      );
    }
    throw e;
  }
}

/** Encaixe: cria um horário no instante escolhido e marca a consulta (F2 — dinâmico). */
export async function criarSlotAdHocAction(formData: FormData) {
  const session = await auth();
  if (!canAccessUnidade(session, "medico")) throw new Error("Sem permissão");
  if (!podeMarcarConsulta(session)) throw new Error("Sem permissão");

  const cidadaoId = String(formData.get("cidadaoId"));
  const especialidadeId = String(formData.get("especialidadeId"));
  const parsed = criarSlotAdHocSchema.safeParse({
    cidadaoId,
    profissionalId: String(formData.get("profissionalId")),
    especialidadeId,
    dataHoraInicio: String(formData.get("dataHoraInicio") ?? ""),
    duracaoMin: String(formData.get("duracaoMin") ?? "30"),
  });
  if (!parsed.success) {
    redirect(
      `/medico/consultas/nova?cidadaoId=${cidadaoId}&especialidadeId=${especialidadeId}&erro=adhoc_invalido` as Route,
    );
  }

  await executarAdHoc(session!.user.id, parsed.data);
}

/**
 * Busca incremental de cidadão no passo 1 do wizard (server-side). Espelha o
 * padrão da capacitação (buscarCandidatosAction): REUSA buildBuscaCidadaoWhere
 * (índices trigram + escopo do médico, sem o LIKE '%%' quebrado), exclui
 * deletados/anonimizados e devolve no máx. 8 resultados. Sem efeito colateral.
 */
export async function buscarCidadaosAction(
  query: string,
): Promise<{ id: string; nome: string; cpf: string; telefone: string }[]> {
  const session = await auth();
  if (!canAccessUnidade(session, "medico") || !podeMarcarConsulta(session)) return [];
  if (!buscaCidadaoValida(query)) return [];

  const cidadaos = await db.cidadao.findMany({
    where: buildBuscaCidadaoWhere(query),
    orderBy: { nomeCompleto: "asc" },
    take: 8,
    select: { id: true, nomeCompleto: true, nomeSocial: true, cpf: true, telefonePrincipal: true },
  });
  return cidadaos.map((c) => ({
    id: c.id,
    nome: c.nomeSocial?.trim() ? c.nomeSocial : c.nomeCompleto,
    cpf: c.cpf ?? "",
    telefone: c.telefonePrincipal ?? "",
  }));
}

/**
 * Cria um cidadão a partir do form mínimo de "Novo paciente" do wizard, quando a
 * ficha ainda não existe. NÃO duplica regra: valida o subconjunto com
 * novoPacienteSchema, mapeia pro CidadaoCreateInput (unitIdOrigem=medico) e delega
 * pra createCidadaoAction — que faz RBAC, CPF duplicado, persistência e logEvent
 * (ficha_created). Devolve o resultado pro wizard seguir com esse cidadão.
 */
export async function criarCidadaoAction(input: NovoPacienteInput): Promise<CreateCidadaoResult> {
  const session = await auth();
  if (!canAccessUnidade(session, "medico") || !podeMarcarConsulta(session)) {
    return { ok: false, errors: {}, message: "Sem permissão" };
  }

  const parsed = novoPacienteSchema.safeParse(input);
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      errors[key] = errors[key] ?? [];
      errors[key].push(issue.message);
    }
    return { ok: false, errors };
  }

  return createCidadaoAction(novoPacienteParaCidadaoInput(parsed.data));
}

/** Walk-in / ordem de chegada: encaixe imediato (dataHoraInicio = agora, 30 min). */
export async function atenderAgoraAction(formData: FormData) {
  const session = await auth();
  if (!canAccessUnidade(session, "medico")) throw new Error("Sem permissão");
  if (!podeMarcarConsulta(session)) throw new Error("Sem permissão");

  const cidadaoId = String(formData.get("cidadaoId"));
  const especialidadeId = String(formData.get("especialidadeId"));
  const parsed = criarSlotAdHocSchema.safeParse({
    cidadaoId,
    profissionalId: String(formData.get("profissionalId")),
    especialidadeId,
    dataHoraInicio: new Date(),
    duracaoMin: 30,
  });
  if (!parsed.success) {
    redirect(
      `/medico/consultas/nova?cidadaoId=${cidadaoId}&especialidadeId=${especialidadeId}&erro=adhoc_invalido` as Route,
    );
  }

  await executarAdHoc(session!.user.id, parsed.data);
}
