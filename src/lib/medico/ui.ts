import type { StatusConsulta, StatusSlot } from "@prisma/client";

/**
 * Linguagem visual do Centro Médico (F1.B.1).
 * Mapeia status de domínio → label PT-BR + variant do Badge canônico.
 * Fonte única pra manter consistência cromática em todas as telas /medico/*.
 */

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info";

interface StatusVisual {
  label: string;
  variant: BadgeVariant;
}

export const CONSULTA_VISUAL: Record<StatusConsulta, StatusVisual> = {
  agendada: { label: "Agendada", variant: "info" },
  confirmada: { label: "Confirmada", variant: "info" },
  em_atendimento: { label: "Em atendimento", variant: "warning" },
  realizada: { label: "Realizada", variant: "success" },
  faltou: { label: "Faltou", variant: "danger" },
  cancelada: { label: "Cancelada", variant: "default" },
};

export const SLOT_VISUAL: Record<StatusSlot, StatusVisual> = {
  disponivel: { label: "Disponível", variant: "success" },
  reservado: { label: "Reservado", variant: "info" },
  bloqueado: { label: "Bloqueado", variant: "warning" },
  realizado: { label: "Realizado", variant: "default" },
  faltou: { label: "Faltou", variant: "danger" },
  cancelado: { label: "Cancelado", variant: "default" },
};

/** Próximos status válidos a partir do atual (espelha TRANSICOES de agenda.ts). */
export const PROXIMOS_STATUS_CONSULTA: Record<StatusConsulta, StatusConsulta[]> = {
  agendada: ["confirmada", "em_atendimento", "faltou", "cancelada"],
  confirmada: ["em_atendimento", "faltou", "cancelada"],
  em_atendimento: ["realizada", "faltou", "cancelada"],
  realizada: [],
  faltou: [],
  cancelada: [],
};

const DIAS_SEMANA_CURTO = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;

/** "ter, qui" a partir de [2,4]. */
export function formatarDiasSemana(dias: readonly number[]): string {
  return dias
    .slice()
    .sort((a, b) => a - b)
    .map((d) => DIAS_SEMANA_CURTO[d] ?? "?")
    .join(", ");
}

/** Cor de texto legível (#fff ou ink) sobre um hex de fundo sólido. */
export function corTextoSobre(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "#fff";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // luminância relativa simplificada
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "rgb(var(--ifp-ink))" : "#fff";
}
