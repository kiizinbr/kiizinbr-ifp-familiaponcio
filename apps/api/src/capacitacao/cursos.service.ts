import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AcaoAuditoria, StatusMatricula, TipoUnidade } from "@ifp/database";

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

  /**
   * Todos os cursos da unidade (ativos e inativos) com o nº de turmas e o % de
   * ocupação do curso (alunos ATIVOS sobre as vagas somadas das turmas). `filtro`
   * opcional: "ativos" só cursos ativos, "inativos" só inativos. Read-only.
   */
  async listarTodos(user: AuthenticatedUser, filtro?: string) {
    const profissional = await this.profissionais.resolverPorUser(
      user,
      TipoUnidade.CAPACITACAO,
    );
    const unidadeId = profissional.unidadeId;

    const ativoFiltro =
      filtro === "ativos" ? true : filtro === "inativos" ? false : undefined;

    const cursos = await this.prisma.curso.findMany({
      where: { unidadeId, ...(ativoFiltro != null ? { ativo: ativoFiltro } : {}) },
      orderBy: [{ ativo: "desc" }, { nome: "asc" }],
      include: {
        _count: { select: { turmas: true } },
        turmas: { select: { id: true, vagasTotais: true } },
      },
    });

    // Ocupação por curso: soma das vagas das turmas vs. alunos ATIVOS. Conta as
    // matrículas ativas em lote (por curso) para evitar N+1.
    const ativasPorCurso = await this.prisma.matricula.groupBy({
      by: ["turmaId"],
      where: { unidadeId, status: StatusMatricula.ATIVA },
      _count: { _all: true },
    });
    const ativasPorTurma = new Map(ativasPorCurso.map((g) => [g.turmaId, g._count._all]));

    const items = cursos.map(({ turmas, ...curso }) => {
      const vagasTotais = turmas.reduce((s, t) => s + t.vagasTotais, 0);
      const alunosAtivos = turmas.reduce((s, t) => s + (ativasPorTurma.get(t.id) ?? 0), 0);
      return {
        ...curso,
        alunosAtivos,
        vagasTotais,
        ocupacaoPct: vagasTotais > 0 ? Math.round((alunosAtivos / vagasTotais) * 100) : null,
      };
    });

    return { items };
  }

  /** Detalhe do curso com a trilha (módulos + ementa) e nº de turmas. */
  async detalhe(user: AuthenticatedUser, id: string) {
    const profissional = await this.profissionais.resolverPorUser(
      user,
      TipoUnidade.CAPACITACAO,
    );
    // Tenant: só cursos da unidade resolvida do profissional (mesmo padrão de
    // listarTodos/atualizar). resolverPorUser já barra unidade de outra área.
    const curso = await this.prisma.curso.findFirst({
      where: { id, unidadeId: profissional.unidadeId },
      include: {
        _count: { select: { turmas: true } },
        modulos: {
          orderBy: { ordem: "asc" },
          include: { itens: { orderBy: { ordem: "asc" } } },
        },
      },
    });
    if (!curso) throw new NotFoundException("Curso não encontrado nesta unidade");

    // Carga horária somada dos módulos (quando informada) — só leitura agregada.
    const cargaModulos = curso.modulos.reduce(
      (acc, m) => acc + (m.cargaHoraria ?? 0),
      0,
    );

    return { ...curso, cargaModulos };
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
