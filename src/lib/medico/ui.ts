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

/** Luminância relativa WCAG (sRGB linearizado) de um canal 0–255. */
function canalLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** Luminância relativa WCAG de um RGB 0–255. */
function luminanciaWcag(r: number, g: number, b: number): number {
  return 0.2126 * canalLinear(r) + 0.7152 * canalLinear(g) + 0.0722 * canalLinear(b);
}

/** Razão de contraste WCAG entre duas luminâncias relativas. */
function razaoContraste(l1: number, l2: number): number {
  const [claro, escuro] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (claro + 0.05) / (escuro + 0.05);
}

// #4a4a49 = --ifp-ink: a alternativa escura ao branco sobre cores claras.
const INK_LUM = luminanciaWcag(0x4a, 0x4a, 0x49);
const BRANCO_LUM = 1;

/**
 * Cor de texto legível sobre um hex de fundo sólido — escolhe entre branco e o
 * ink institucional o de MAIOR contraste WCAG real (não um limiar de luminância
 * aproximado, que mantinha branco mesmo quando o ink contrastava melhor). Garante
 * o melhor caso AA possível para cores de especialidade de tom médio/claro.
 */
export function corTextoSobre(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "#fff";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const fundo = luminanciaWcag(r, g, b);
  const contrasteBranco = razaoContraste(BRANCO_LUM, fundo);
  const contrasteInk = razaoContraste(INK_LUM, fundo);
  return contrasteInk > contrasteBranco ? "rgb(var(--ifp-ink))" : "#fff";
}
