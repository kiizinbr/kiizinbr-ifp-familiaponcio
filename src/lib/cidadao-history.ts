/**
 * Histórico / timeline da Ficha Cidadã (Plano 3 Task 9).
 *
 * Padrão "pure core, I/O shell":
 * - `buildHistoryTimeline` é PURA (arrays → eventos ordenados) → testável sem banco.
 * - `getCidadaoHistory` faz auth/RBAC + query e delega à pura.
 *
 * A timeline é um READ MODEL: combina eventos do audit log com o estado atual do
 * registro (âncora sintética "Ficha criada") — eventos derivados são marcados.
 */

import type { Session } from "next-auth";
import { db } from "@/lib/db";
import { getCidadao } from "@/lib/cidadao";
import { hasAnyRole } from "@/lib/rbac";

export type HistoryEventAction =
  | "ficha_created"
  | "ficha_updated"
  | "anexo_uploaded"
  | "anexo_removed"
  | "triagem_aberta"
  | "triagem_concluida"
  | "elegibilidade_decidida"
  | "agendamento_criado"
  | "agendamento_realizado"
  | "outro";

export interface HistoryEvent {
  id: string;
  action: HistoryEventAction;
  label: string;
  detalhe: string | null;
  autor: string;
  data: Date;
  derivado: boolean;
}

/** Linha do audit log relevante ao cidadão (subset do que a query traz). */
export interface AuditRowInput {
  id: string;
  action: string;
  createdAt: Date;
  meta: Record<string, unknown> | null;
  user: { name: string | null; email: string } | null;
}

/** Dados do próprio registro Cidadao, usados pra ancorar a timeline. */
export interface CidadaoAnchorInput {
  id: string;
  createdAt: Date;
  createdBy: { name: string | null; email: string } | null;
}

/** Capacidades de visão do espectador (mesma RBAC de seção do detalhe). */
export interface ViewerCaps {
  verSaude: boolean;
  verSocio: boolean;
}

/**
 * Rótulos pt-BR que a equipe do IFP lê na timeline.
 * NOTA (ponto aberto pro Erick): wording da UI — ajustar pro vocabulário da casa.
 */
const ACTION_LABELS: Record<HistoryEventAction, string> = {
  ficha_created: "Ficha criada",
  ficha_updated: "Ficha atualizada",
  anexo_uploaded: "Anexo adicionado",
  anexo_removed: "Anexo removido",
  triagem_aberta: "Triagem aberta",
  triagem_concluida: "Triagem concluída",
  elegibilidade_decidida: "Elegibilidade decidida",
  agendamento_criado: "Agendamento criado",
  agendamento_realizado: "Entrevista realizada",
  outro: "Evento registrado",
};

/** Nota exibida no lugar do nome de um campo que o espectador não pode ver. */
const NOTA_CAMPO_RESTRITO = "campo restrito";

/** Humaniza nomes de campo do schema pra exibição. Fallback: o próprio nome. */
const FIELD_LABELS: Record<string, string> = {
  nomeCompleto: "Nome completo",
  nomeSocial: "Nome social",
  telefonePrincipal: "Telefone principal",
  telefoneSecundario: "Telefone secundário",
  email: "E-mail",
  rendaFamiliar: "Renda familiar",
  pessoasNaCasa: "Pessoas na casa",
  beneficioSocial: "Benefício social",
  escolaridade: "Escolaridade",
  trabalha: "Trabalha",
  trabalhoDescricao: "Descrição do trabalho",
  tipoSanguineo: "Tipo sanguíneo",
  alergias: "Alergias",
  medicamentosEmUso: "Medicamentos em uso",
  condicoesCronicas: "Condições crônicas",
};

/** Campos só visíveis a perfis com acesso a Saúde (§0.1). */
const CAMPOS_SAUDE = new Set([
  "tipoSanguineo",
  "alergias",
  "medicamentosEmUso",
  "condicoesCronicas",
]);

/** Campos só visíveis a perfis com acesso ao Socioeconômico (§0.1). */
const CAMPOS_SOCIO = new Set([
  "rendaFamiliar",
  "pessoasNaCasa",
  "beneficioSocial",
  "escolaridade",
  "trabalha",
  "trabalhoDescricao",
]);

const KNOWN_ACTIONS = new Set<HistoryEventAction>([
  "ficha_created",
  "ficha_updated",
  "anexo_uploaded",
  "anexo_removed",
  "triagem_aberta",
  "triagem_concluida",
  "elegibilidade_decidida",
  "agendamento_criado",
  "agendamento_realizado",
]);

/** Rótulos pt-BR das unidades pra exibição em detalhes de eventos. */
const UNIDADE_LABELS: Record<string, string> = {
  medico: "Centro Médico",
  capacitacao: "Centro de Capacitação",
  esportivo: "Centro Esportivo",
  recreativo: "Centro Recreativo",
};

function normalizeAction(raw: string): HistoryEventAction {
  return KNOWN_ACTIONS.has(raw as HistoryEventAction) ? (raw as HistoryEventAction) : "outro";
}

function autorDe(user: { name: string | null; email: string } | null): string {
  if (!user) return "Sistema";
  return user.name ?? user.email;
}

/** Espectador não pode ver o campo se ele é de Saúde/Socio e a capability está off. */
function campoRestrito(campo: string, caps: ViewerCaps): boolean {
  return (CAMPOS_SAUDE.has(campo) && !caps.verSaude) || (CAMPOS_SOCIO.has(campo) && !caps.verSocio);
}

/**
 * Monta o `detalhe` de um ficha_updated aplicando a RBAC de seção (Refinement B):
 * campos restritos não têm o nome exibido. Se sobram só restritos, mostra a nota.
 */
function detalheFichaUpdated(
  meta: Record<string, unknown> | null,
  caps: ViewerCaps,
): string | null {
  const changed = Array.isArray(meta?.changedFields) ? (meta.changedFields as string[]) : [];
  if (changed.length === 0) return null;

  const visiveis: string[] = [];
  let temRestrito = false;
  for (const campo of changed) {
    if (campoRestrito(campo, caps)) {
      temRestrito = true;
      continue;
    }
    visiveis.push(FIELD_LABELS[campo] ?? campo);
  }

  if (temRestrito) visiveis.push(NOTA_CAMPO_RESTRITO);
  return visiveis.length > 0 ? visiveis.join(", ") : null;
}

function detalheDe(
  action: HistoryEventAction,
  meta: Record<string, unknown> | null,
  caps: ViewerCaps,
): string | null {
  switch (action) {
    case "anexo_uploaded":
    case "anexo_removed":
      return typeof meta?.fileName === "string" ? meta.fileName : null;
    case "ficha_updated":
      return detalheFichaUpdated(meta, caps);
    case "elegibilidade_decidida": {
      const unidade = typeof meta?.unidade === "string" ? meta.unidade : null;
      const status = typeof meta?.status === "string" ? meta.status : null;
      if (!unidade || !status) return status;
      return `${UNIDADE_LABELS[unidade] ?? unidade}: ${status}`;
    }
    default:
      return null;
  }
}

/**
 * Constrói a timeline (read model) a partir das linhas de audit + o registro do cidadão.
 * Pura: sem I/O. Ordena desc por data e injeta a âncora "Ficha criada" derivada do
 * registro quando o log não tem um ficha_created real.
 */
export function buildHistoryTimeline(
  auditRows: AuditRowInput[],
  cidadao: CidadaoAnchorInput,
  caps: ViewerCaps,
): HistoryEvent[] {
  const events: HistoryEvent[] = auditRows.map((r) => {
    const action = normalizeAction(r.action);
    return {
      id: r.id,
      action,
      label: ACTION_LABELS[action],
      detalhe: detalheDe(action, r.meta, caps),
      autor: autorDe(r.user),
      data: r.createdAt,
      derivado: false,
    };
  });

  const temCriacaoReal = events.some((e) => e.action === "ficha_created");
  if (!temCriacaoReal) {
    events.push({
      id: `anchor:${cidadao.id}`,
      action: "ficha_created",
      label: ACTION_LABELS.ficha_created,
      detalhe: null,
      autor: autorDe(cidadao.createdBy),
      data: cidadao.createdAt,
      derivado: true,
    });
  }

  events.sort((a, b) => b.data.getTime() - a.data.getTime());
  return events;
}

/**
 * Busca o histórico de um cidadão respeitando RBAC. Retorna `null` quando o
 * espectador não tem acesso (caller deve responder notFound/404).
 *
 * Usa a query indexada por aggregate root (`rootEntityType`/`rootEntityId`),
 * que captura tanto os eventos da própria ficha quanto os de sub-entidades
 * (anexos hoje; triagem no Plano 4) sem OR nem scan de JSON.
 */
export async function getCidadaoHistory(cidadaoId: string, session: Session | null) {
  if (!session) return null;

  const cidadao = await getCidadao(cidadaoId, session);
  if (!cidadao) return null;

  const caps: ViewerCaps = {
    verSaude: hasAnyRole(session, "super_admin", "gestor_unidade", "profissional"),
    verSocio: hasAnyRole(session, "super_admin", "presidencia", "social"),
  };

  const rows = await db.auditLog.findMany({
    where: { rootEntityType: "cidadao", rootEntityId: cidadaoId },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  const auditRows: AuditRowInput[] = rows.map((r) => ({
    id: r.id,
    action: r.action,
    createdAt: r.createdAt,
    meta: (r.meta as Record<string, unknown> | null) ?? null,
    user: r.user ? { name: r.user.name, email: r.user.email } : null,
  }));

  const anchor: CidadaoAnchorInput = {
    id: cidadao.id,
    createdAt: cidadao.createdAt,
    createdBy: cidadao.createdBy
      ? { name: cidadao.createdBy.name, email: cidadao.createdBy.email }
      : null,
  };

  return { cidadao, timeline: buildHistoryTimeline(auditRows, anchor, caps) };
}
