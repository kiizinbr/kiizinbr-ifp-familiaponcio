import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AcaoAuditoria, Perfil, StatusMatricula, TipoUnidade } from "@ifp/database";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/current-user.decorator";
import type { ConcederGraduacaoDto } from "./dto/conceder-graduacao.dto";
import { ProfissionaisService } from "../medico/profissionais.service";

@Injectable()
export class GraduacoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly profissionais: ProfissionaisService,
  ) {}

  /** Concede um nível da trilha da modalidade ao atleta (molde do certificado). */
  async conceder(user: AuthenticatedUser, matriculaId: string, dto: ConcederGraduacaoDto) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.ESPORTIVO);

    const matricula = await this.prisma.matriculaEsportiva.findUnique({
      where: { id: matriculaId },
      include: { turma: { include: { modalidade: true } } },
    });
    if (!matricula) throw new NotFoundException("Matrícula não encontrada");
    if (
      !user.perfis.includes(Perfil.SUPER_ADMIN) &&
      matricula.unidadeId !== profissional.unidadeId
    ) {
      throw new ForbiddenException("Esta matrícula pertence a outra unidade.");
    }
    if (
      matricula.status !== StatusMatricula.ATIVA &&
      matricula.status !== StatusMatricula.CONCLUIDA
    ) {
      throw new BadRequestException(
        "Graduação só pode ser concedida a matrícula ativa ou concluída.",
      );
    }

    const trilha = matricula.turma.modalidade.trilhaGraduacoes;
    if (!trilha.includes(dto.nivel)) {
      throw new BadRequestException(
        `Nível fora da trilha da modalidade ${matricula.turma.modalidade.nome}. ` +
          `Níveis válidos: ${trilha.join(", ")}.`,
      );
    }

    const jaConcedida = await this.prisma.graduacao.findUnique({
      where: { matriculaId_nivel: { matriculaId, nivel: dto.nivel } },
      select: { id: true },
    });
    if (jaConcedida) {
      throw new ConflictException("Este nível já foi concedido a este atleta.");
    }

    const graduacao = await this.prisma.graduacao.create({
      data: {
        unidadeId: matricula.unidadeId,
        matriculaId,
        nivel: dto.nivel,
        observacao: dto.observacao,
        concedidaPor: user.id,
      },
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.CREATE,
      entidade: "Graduacao",
      entidadeId: graduacao.id,
      metadados: {
        matriculaId,
        nivel: dto.nivel,
        modalidade: matricula.turma.modalidade.nome,
      },
    });

    return graduacao;
  }
}
