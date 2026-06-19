import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AcaoAuditoria, TipoUnidade } from "@ifp/database";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { ProfissionaisService } from "../medico/profissionais.service";
import type { AuthenticatedUser } from "../auth/current-user.decorator";
import type { CriarCursoDto } from "./dto/criar-curso.dto";
import type { AtualizarCursoDto } from "./dto/atualizar-curso.dto";

@Injectable()
export class CursosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly profissionais: ProfissionaisService,
  ) {}

  /** Todos os cursos da unidade (ativos e inativos) com o nº de turmas. */
  async listarTodos(user: AuthenticatedUser) {
    const profissional = await this.profissionais.resolverPorUser(
      user,
      TipoUnidade.CAPACITACAO,
    );
    const items = await this.prisma.curso.findMany({
      where: { unidadeId: profissional.unidadeId },
      orderBy: [{ ativo: "desc" }, { nome: "asc" }],
      include: { _count: { select: { turmas: true } } },
    });
    return { items };
  }

  async criar(user: AuthenticatedUser, dto: CriarCursoDto) {
    const profissional = await this.profissionais.resolverPorUser(
      user,
      TipoUnidade.CAPACITACAO,
    );
    const nome = dto.nome.trim();

    const existe = await this.prisma.curso.findFirst({
      where: {
        unidadeId: profissional.unidadeId,
        nome: { equals: nome, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (existe) {
      throw new ConflictException(`Já existe um curso "${nome}" nesta unidade.`);
    }

    const curso = await this.prisma.curso.create({
      data: {
        unidadeId: profissional.unidadeId,
        nome,
        modalidade: dto.modalidade,
        cargaHorariaTotal: dto.cargaHorariaTotal,
        presencaMinimaPct: dto.presencaMinimaPct ?? 75,
        requerModelos: dto.requerModelos ?? false,
      },
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.CREATE,
      entidade: "Curso",
      entidadeId: curso.id,
      metadados: { nome: curso.nome, modalidade: curso.modalidade },
    });
    return curso;
  }

  async atualizar(user: AuthenticatedUser, id: string, dto: AtualizarCursoDto) {
    const profissional = await this.profissionais.resolverPorUser(
      user,
      TipoUnidade.CAPACITACAO,
    );
    const curso = await this.prisma.curso.findFirst({
      where: { id, unidadeId: profissional.unidadeId },
    });
    if (!curso) throw new NotFoundException("Curso não encontrado nesta unidade");

    const nome = dto.nome?.trim();
    if (nome && nome.toLowerCase() !== curso.nome.toLowerCase()) {
      const conflito = await this.prisma.curso.findFirst({
        where: {
          unidadeId: profissional.unidadeId,
          nome: { equals: nome, mode: "insensitive" },
          id: { not: id },
        },
        select: { id: true },
      });
      if (conflito) {
        throw new ConflictException(`Já existe um curso "${nome}" nesta unidade.`);
      }
    }

    const atualizado = await this.prisma.curso.update({
      where: { id },
      data: {
        ...(nome ? { nome } : {}),
        ...(dto.modalidade ? { modalidade: dto.modalidade } : {}),
        ...(dto.cargaHorariaTotal != null
          ? { cargaHorariaTotal: dto.cargaHorariaTotal }
          : {}),
        ...(dto.presencaMinimaPct != null
          ? { presencaMinimaPct: dto.presencaMinimaPct }
          : {}),
        ...(dto.requerModelos != null ? { requerModelos: dto.requerModelos } : {}),
        ...(dto.ativo != null ? { ativo: dto.ativo } : {}),
      },
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.UPDATE,
      entidade: "Curso",
      entidadeId: id,
      metadados: { campos: Object.keys(dto) },
    });
    return atualizado;
  }
}
