import { SetMetadata } from "@nestjs/common";
import type { Perfil } from "@ifp/database";

export const PERFIS_KEY = "perfis";

/**
 * Restringe um endpoint a usuários com pelo menos um dos perfis listados.
 * Usar em conjunto com `JwtAuthGuard` + `PerfisGuard`.
 *
 *   @UseGuards(JwtAuthGuard, PerfisGuard)
 *   @Perfis("SERVICO_SOCIAL", "SUPER_ADMIN")
 */
export const Perfis = (...perfis: Perfil[]) => SetMetadata(PERFIS_KEY, perfis);
