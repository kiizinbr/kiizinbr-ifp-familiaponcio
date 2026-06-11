import { Injectable, NotFoundException } from "@nestjs/common";
import { AcaoAuditoria, TipoUnidade } from "@ifp/database";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/current-user.decorator";
import { ProfissionaisService } from "../medico/profissionais.service";
import type { CriarComunicadoDto } from "./dto/criar-comunicado.dto";

@Injectable()
export class ComunicadosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly profissionais: ProfissionaisService,
  ) {}

  async criar(user: AuthenticatedUser, dto: CriarComunicadoDto) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.EDUCACIONAL);

    if (dto.turmaId) {
      const turma = await this.prisma.turmaInfantil.findFirst({
        where: { id: dto.turmaId, unidadeId: profissional.unidadeId },
        select: { id: true },
      });
      if (!turma) throw new NotFoundException("Turma não encontrada nesta unidade");
    }

    const comunicado = await this.prisma.comunicado.create({
      data: {
        unidadeId: profissional.unidadeId,
        turmaId: dto.turmaId,
        titulo: dto.titulo,
        corpo: dto.corpo,
        critico: dto.critico ?? false,
        enviadoPor: user.id,
      },
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.CREATE,
      entidade: "Comunicado",
      entidadeId: comunicado.id,
      metadados: { critico: comunicado.critico, turmaId: dto.turmaId ?? null },
    });

    return comunicado;
  }

  /** Lista da unidade com nº de leituras (pendência = crítico com 0 leituras). */
  async listar(user: AuthenticatedUser) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.EDUCACIONAL);
    const items = await this.prisma.comunicado.findMany({
      where: { unidadeId: profissional.unidadeId },
      orderBy: { criadoEm: "desc" },
      take: 50,
      include: { _count: { select: { leituras: true } } },
    });
    return { items };
  }
}
