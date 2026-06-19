import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AcaoAuditoria, Perfil, TipoUnidade } from "@ifp/database";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/current-user.decorator";
import type { EditarProfissionalDto, VincularProfissionalDto } from "./dto/profissional.dto";

const profissionalSelect = {
  id: true,
  especialidade: true,
  registroConselho: true,
  ufConselho: true,
  ativo: true,
  user: { select: { id: true, nome: true, email: true } },
} as const;

/**
 * Gestão da equipe do Centro Médico: vincula um usuário (perfil PROFISSIONAL,
 * lotado na unidade médica) a um cadastro de Profissional — sem isso o usuário
 * criado pelo /admin não consegue operar a agenda. Resolve a unidade pelo TIPO
 * (não exige que o ATOR tenha cadastro de Profissional, ao contrário das telas
 * operacionais), para o admin/gestor conseguir gerir.
 */
@Injectable()
export class EquipeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async unidadeMedica(user: AuthenticatedUser): Promise<string> {
    const unidade = await this.prisma.unidade.findUnique({
      where: { tipo: TipoUnidade.MEDICO },
      select: { id: true },
    });
    if (!unidade) throw new NotFoundException("Unidade médica não encontrada");
    if (user.perfis.includes(Perfil.SUPER_ADMIN)) return unidade.id;
    const vinc = await this.prisma.usuarioUnidade.findFirst({
      where: { userId: user.id, unidadeId: unidade.id },
      select: { id: true },
    });
    if (!vinc) throw new ForbiddenException("Você não gere a unidade médica.");
    return unidade.id;
  }

  async listar(user: AuthenticatedUser) {
    const unidadeId = await this.unidadeMedica(user);
    const items = await this.prisma.profissional.findMany({
      where: { unidadeId },
      orderBy: [{ ativo: "desc" }, { criadoEm: "desc" }],
      select: profissionalSelect,
    });
    return { items };
  }

  /** Usuários PROFISSIONAL lotados na unidade médica e ainda SEM cadastro. */
  async candidatos(user: AuthenticatedUser) {
    const unidadeId = await this.unidadeMedica(user);
    const items = await this.prisma.user.findMany({
      where: {
        ativo: true,
        perfis: { some: { perfil: Perfil.PROFISSIONAL } },
        unidades: { some: { unidadeId } },
        profissional: { is: null },
      },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, email: true },
    });
    return { items };
  }

  async vincular(user: AuthenticatedUser, dto: VincularProfissionalDto) {
    const unidadeId = await this.unidadeMedica(user);
    const alvo = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      include: {
        profissional: { select: { id: true } },
        unidades: { select: { unidadeId: true } },
        perfis: { select: { perfil: true } },
      },
    });
    if (!alvo) throw new NotFoundException("Usuário não encontrado");
    if (alvo.profissional) {
      throw new ConflictException("Este usuário já tem cadastro de profissional.");
    }
    if (!alvo.unidades.some((u) => u.unidadeId === unidadeId)) {
      throw new BadRequestException("O usuário não está lotado na unidade médica.");
    }
    if (!alvo.perfis.some((p) => p.perfil === Perfil.PROFISSIONAL)) {
      throw new BadRequestException("O usuário não tem o perfil Profissional.");
    }

    const prof = await this.prisma.profissional.create({
      data: {
        userId: dto.userId,
        unidadeId,
        especialidade: dto.especialidade,
        registroConselho: dto.registroConselho,
        ufConselho: dto.ufConselho ?? "RJ",
      },
      select: profissionalSelect,
    });
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.CREATE,
      entidade: "Profissional",
      entidadeId: prof.id,
      metadados: { userId: dto.userId },
    });
    return prof;
  }

  async editar(user: AuthenticatedUser, profId: string, dto: EditarProfissionalDto) {
    const unidadeId = await this.unidadeMedica(user);
    const prof = await this.prisma.profissional.findUnique({
      where: { id: profId },
      select: { id: true, unidadeId: true },
    });
    if (!prof || prof.unidadeId !== unidadeId) {
      throw new NotFoundException("Profissional não encontrado");
    }

    const atualizado = await this.prisma.profissional.update({
      where: { id: profId },
      data: {
        ...(dto.especialidade !== undefined ? { especialidade: dto.especialidade } : {}),
        ...(dto.registroConselho !== undefined ? { registroConselho: dto.registroConselho } : {}),
        ...(dto.ufConselho ? { ufConselho: dto.ufConselho } : {}),
        ...(dto.ativo != null ? { ativo: dto.ativo } : {}),
      },
      select: profissionalSelect,
    });
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.UPDATE,
      entidade: "Profissional",
      entidadeId: profId,
      metadados: { campos: Object.keys(dto) },
    });
    return atualizado;
  }
}
