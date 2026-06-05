import { z } from "zod";
import {
  ROLE_NAMES,
  UNIT_SCOPES,
  GLOBAL_ROLES,
  type RoleName,
  type UnitScope,
} from "@/lib/rbac-types";

/**
 * Provisionamento de usuário (Fase 1 / Identidade). Validação da coerência
 * papel↔unidade: papel global (super_admin/presidencia/social) NÃO leva unidade;
 * papel de unidade (gestor_unidade/profissional/recepcao) EXIGE uma unidade.
 */
export function escopoCoerente(roleName: RoleName, unitScope: UnitScope | null): boolean {
  return GLOBAL_ROLES.includes(roleName) ? unitScope === null : unitScope !== null;
}

export const criarUsuarioSchema = z
  .object({
    name: z.string().trim().min(2, "Nome muito curto"),
    email: z.string().trim().toLowerCase().email("E-mail inválido"),
    password: z.string().min(8, "Senha deve ter ao menos 8 caracteres"),
    roleName: z.enum(ROLE_NAMES),
    unitScope: z
      .union([z.enum(UNIT_SCOPES), z.literal("")])
      .optional()
      .transform((v) => (v ? v : null)),
  })
  .refine((d) => escopoCoerente(d.roleName, d.unitScope), {
    message: "Papel global não leva unidade; papel de unidade exige uma unidade.",
    path: ["unitScope"],
  });

export type CriarUsuarioInput = z.infer<typeof criarUsuarioSchema>;
