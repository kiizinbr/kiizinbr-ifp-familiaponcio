import { ForbiddenException, Injectable } from "@nestjs/common";
import { Perfil, TipoUnidade, type Profissional } from "@ifp/database";

import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/current-user.decorator";

/**
 * Resolve o cadastro de Profissional do usuário logado.
 * Mesmo SUPER_ADMIN precisa de cadastro para operar (decisão da Fase 1).
 */
@Injectable()
export class ProfissionaisService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve o Profissional e VALIDA que ele pertence à unidade esperada.
   *
   * Sem o `tipoEsperado`, um instrutor da Capacitação (mesmo modelo `Profissional`,
   * mesmo perfil `PROFISSIONAL`, só muda o `unidadeId`) passaria pelos guards de
   * `/medico/*` e enumeraria PII de pacientes — o vazamento cross-unidade do review.
   * Aqui o `TipoUnidade` é a parede: cada módulo passa o seu.
   */
  async resolverPorUser(
    user: AuthenticatedUser,
    tipoEsperado: TipoUnidade,
  ): Promise<Profissional> {
    const profissional = await this.prisma.profissional.findUnique({
      where: { userId: user.id },
      include: { unidade: { select: { tipo: true } } },
    });
    if (!profissional || !profissional.ativo) {
      throw new ForbiddenException(
        "Usuário não possui cadastro de Profissional ativo.",
      );
    }
    if (profissional.unidade.tipo !== tipoEsperado) {
      throw new ForbiddenException(
        "Seu cadastro de Profissional pertence a outra unidade.",
      );
    }
    // Não vaza a relação incluída no retorno (mantém o contrato Profissional).
    const { unidade: _unidade, ...prof } = profissional;
    return prof;
  }

  /** Dono do registro ou SUPER_ADMIN — senão 403. */
  assertOwnership(
    profissionalIdDoRegistro: string,
    profissional: Profissional,
    user: AuthenticatedUser,
  ): void {
    const isAdmin = user.perfis.includes(Perfil.SUPER_ADMIN);
    if (!isAdmin && profissionalIdDoRegistro !== profissional.id) {
      throw new ForbiddenException("Este registro pertence a outro profissional.");
    }
  }
}
