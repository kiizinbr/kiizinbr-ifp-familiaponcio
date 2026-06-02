import type { StatusMatricula, StatusTurma } from "@prisma/client";

/**
 * Linguagem visual da Capacitação (F1.A.1). Espelha CONSULTA_VISUAL do Médico:
 * status de domínio → label PT-BR + variant do Badge canônico. Fonte única.
 */

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info";

interface StatusVisual {
  label: string;
  variant: BadgeVariant;
}

export const MATRICULA_VISUAL: Record<StatusMatricula, StatusVisual> = {
  inscrito: { label: "Inscrito", variant: "info" },
  confirmado: { label: "Confirmado", variant: "info" },
  cursando: { label: "Cursando", variant: "warning" },
  concluido: { label: "Concluído", variant: "success" },
  reprovado: { label: "Reprovado", variant: "danger" },
  desistente: { label: "Desistente", variant: "default" },
  lista_espera: { label: "Lista de espera", variant: "default" },
  cancelado: { label: "Cancelado", variant: "default" },
};

export const STATUS_TURMA_VISUAL: Record<StatusTurma, StatusVisual> = {
  planejada: { label: "Planejada", variant: "default" },
  inscricoes_abertas: { label: "Inscrições abertas", variant: "info" },
  em_andamento: { label: "Em andamento", variant: "warning" },
  concluida: { label: "Concluída", variant: "success" },
  cancelada: { label: "Cancelada", variant: "default" },
};
