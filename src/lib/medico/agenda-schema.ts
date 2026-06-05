import { z } from "zod";

/**
 * Schemas de validação das server actions de agenda/consulta (B4). Antes os
 * valores de FormData iam crus pro Prisma (`String(...)` / `new Date(...)`),
 * gerando IDs vazios ou `Invalid Date` que viravam 500 opaco. Puro/testável.
 */

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATA_YMD = /^\d{4}-\d{2}-\d{2}$/;

/** Reserva de consulta — IDs (cuid) não podem chegar vazios ao banco. */
export const reservarConsultaSchema = z.object({
  slotId: z.string().min(1, "Slot obrigatório"),
  cidadaoId: z.string().min(1, "Cidadão obrigatório"),
  profissionalId: z.string().min(1, "Profissional obrigatório"),
  especialidadeId: z.string().min(1, "Especialidade obrigatória"),
});

/** Template de agenda recorrente — valida dias, horários e janela de validade. */
export const criarTemplateSchema = z
  .object({
    diasSemana: z
      .array(z.number().int().min(0).max(6))
      .min(1, "Selecione ao menos 1 dia da semana"),
    faixaInicio: z.string().regex(HHMM, "Horário inicial inválido (use HH:mm)"),
    faixaFim: z.string().regex(HHMM, "Horário final inválido (use HH:mm)"),
    duracaoSlotMin: z
      .number()
      .int()
      .min(5, "Duração mínima de 5 min")
      .max(240, "Duração máxima de 240 min"),
    especialidadeId: z.string().min(1, "Selecione a especialidade"),
    validoDe: z.string().regex(DATA_YMD, "Data de início inválida"),
    validoAte: z.union([z.string().regex(DATA_YMD), z.literal("")]).optional(),
  })
  .refine((d) => d.faixaInicio < d.faixaFim, {
    message: "O horário final deve ser depois do inicial",
    path: ["faixaFim"],
  });

export type CriarTemplateInput = z.infer<typeof criarTemplateSchema>;
