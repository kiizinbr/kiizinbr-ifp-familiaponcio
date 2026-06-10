import { ForbiddenException, Injectable } from "@nestjs/common";
import { Perfil, type Profissional } from "@ifp/database";

import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/current-user.decorator";

/**
 * Resolve o cadastro de Profissional do usuário logado.
 * Mesmo SUPER_ADMIN precisa de cadastro para operar a agenda
 * (decisão da Fase 1 — admin não tem agenda própria).
 */
@Injectable()
export class ProfissionaisService {
  constructor(private readonly prisma: PrismaService) {}

  async resolverPorUser(user: AuthenticatedUser): Promise<Profissional> {
    const profissional = await this.prisma.profissional.findUnique({
      where: { userId: user.id },
    });
    if (!profissional || !profissional.ativo) {
      throw new ForbiddenException(
        "Usuário não possui cadastro de Profissional ativo no Centro Médico.",
      );
    }
    return profissional;
  }

  /** Dono do registro ou SUPER_ADMIN — senão 403. */
  assertOwnership(
    profissionalIdDoRegistro: string,
    profissional: Profissional,
    user: AuthenticatedUser,
  ): void {
    const isAdmin = user.perfis.includes(Perfil.SUPER_ADMIN);
    if (!isAdmin && profissionalIdDoRegistro !== profissional.id) {
      throw new ForbiddenException("Este atendimento pertence a outro profissional.");
    }
  }
}
