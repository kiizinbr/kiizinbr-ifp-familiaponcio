import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AcaoAuditoria,
  Perfil,
  Prisma,
  StatusElegibilidade,
  StatusMatricula,
  StatusPresenca,
  StatusTurma,
} from "@ifp/database";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/current-user.decorator";
import type { CriarMatriculaDto } from "./dto/criar-matricula.dto";
import type { CriarTurmaDto } from "./dto/criar-turma.dto";
import { ProfissionaisService } from "../medico/profissionais.service";

const turmaDetalheInclude = {
  curso: true,
  instrutor: { include: { user: { select: { nome: true } } } },
  aulas: { orderBy: { data: "asc" as const } },
  matriculas: {
    include: {
      ficha: { select: { id: true, protocolo: true, nomeCompleto: true } },
      membro: { select: { id: true, nomeCompleto: true } },
      certificado: true,
      presencas: { where: { aula: { encerradaEm: { not: null } } } },
    },
  },
} satisfies Prisma.TurmaInclude;

@Injectable()
export class TurmasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly profissionais: ProfissionaisService,
  ) {}

  /** % de presença sobre as aulas ENCERRADAS (PRESENTE e JUSTIFICADA contam). */
  private presencaPct(
    presencas: { status: StatusPresenca }[],
    totalAulasEncerradas: number,
  ): number {
    if (totalAulasEncerradas === 0) return 0;
    const validas = presencas.filter((p) => p.status !== StatusPresenca.FALTA).length;
    return (validas / totalAulasEncerradas) * 100;
  }

  async listar(user: AuthenticatedUser) {
    const profissional = await this.profissionais.resolverPorUser(user);
    const items = await this.prisma.turma.findMany({
      where: { unidadeId: profissional.unidadeId },
      orderBy: { criadoEm: "desc" },
      include: {
        curso: true,
        _count: { select: { matriculas: true, aulas: true } },
      },
    });
    return { items };
  }

  /** Cursos ativos da unidade (para o formulário de nova turma). */
  async cursos(user: AuthenticatedUser) {
    const profissional = await this.profissionais.resolverPorUser(user);
    const items = await this.prisma.curso.findMany({
      where: { unidadeId: profissional.unidadeId, ativo: true },
      orderBy: { nome: "asc" },
    });
    return { items };
  }

  /** KPIs da unidade (dashboard). */
  async resumo(user: AuthenticatedUser) {
    const profissional = await this.profissionais.resolverPorUser(user);
    const unidadeId = profissional.unidadeId;
    const [turmasEmAndamento, alunosAtivos, certificadosEmitidos, listaEspera] =
      await this.prisma.$transaction([
        this.prisma.turma.count({
          where: { unidadeId, status: StatusTurma.EM_ANDAMENTO },
        }),
        this.prisma.matricula.count({
          where: { unidadeId, status: StatusMatricula.ATIVA },
        }),
        this.prisma.certificado.count({ where: { unidadeId } }),
        this.prisma.matricula.count({
          where: { unidadeId, status: StatusMatricula.LISTA_ESPERA },
        }),
      ]);
    return { turmasEmAndamento, alunosAtivos, certificadosEmitidos, listaEspera };
  }

  /** Fichas APROVADAS na Capacitação (para o formulário de matrícula). */
  async fichasElegiveis(user: AuthenticatedUser, q?: string) {
    const profissional = await this.profissionais.resolverPorUser(user);
    const termo = q?.trim();
    if (!termo || termo.length < 2) return { items: [] };

    const items = await this.prisma.fichaCidada.findMany({
      where: {
        ativa: true,
        nomeCompleto: { contains: termo, mode: "insensitive" },
        elegibilidades: {
          some: {
            unidadeId: profissional.unidadeId,
            status: StatusElegibilidade.APROVADO,
          },
        },
      },
      take: 10,
      orderBy: { nomeCompleto: "asc" },
      select: {
        id: true,
        protocolo: true,
        nomeCompleto: true,
        membros: { select: { id: true, nomeCompleto: true, parentesco: true } },
      },
    });
    return { items };
  }

  /** Cria uma turma; o profissional logado é o instrutor responsável. */
  async criar(user: AuthenticatedUser, dto: CriarTurmaDto) {
    const profissional = await this.profissionais.resolverPorUser(user);

    const curso = await this.prisma.curso.findFirst({
      where: { id: dto.cursoId, unidadeId: profissional.unidadeId, ativo: true },
    });
    if (!curso) throw new NotFoundException("Curso não encontrado nesta unidade");

    const codigoExiste = await this.prisma.turma.findUnique({
      where: { codigo: dto.codigo },
      select: { id: true },
    });
    if (codigoExiste) {
      throw new ConflictException(`Já existe uma turma com o código ${dto.codigo}.`);
    }

    const turma = await this.prisma.turma.create({
      data: {
        unidadeId: profissional.unidadeId,
        cursoId: curso.id,
        codigo: dto.codigo,
        profissionalId: profissional.id,
        diasHorario: dto.diasHorario,
        sala: dto.sala,
        inicioEm: new Date(dto.inicioEm),
        vagasTotais: dto.vagasTotais,
        status: StatusTurma.EM_ANDAMENTO,
      },
      include: { curso: true, _count: { select: { matriculas: true, aulas: true } } },
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.CREATE,
      entidade: "Turma",
      entidadeId: turma.id,
      metadados: { codigo: turma.codigo, curso: curso.nome },
    });

    return turma;
  }

  /** Matricula respeitando a regra de ouro (elegibilidade APROVADA) e as vagas. */
  async matricular(user: AuthenticatedUser, turmaId: string, dto: CriarMatriculaDto) {
    const profissional = await this.profissionais.resolverPorUser(user);
    const turma = await this.prisma.turma.findUnique({
      where: { id: turmaId },
      include: { _count: { select: { matriculas: { where: { status: StatusMatricula.ATIVA } } } } },
    });
    if (!turma) throw new NotFoundException("Turma não encontrada");
    this.profissionais.assertOwnership(turma.profissionalId, profissional, user);
    if (turma.status === StatusTurma.ENCERRADA) {
      throw new BadRequestException("A turma já foi encerrada.");
    }

    // Regra de ouro: só matricula quem o Serviço Social aprovou para a Capacitação.
    const elegivel = await this.prisma.elegibilidadePorUnidade.findFirst({
      where: {
        fichaId: dto.fichaId,
        unidadeId: turma.unidadeId,
        status: StatusElegibilidade.APROVADO,
      },
    });
    if (!elegivel) {
      throw new BadRequestException(
        "Esta família não tem elegibilidade APROVADA na Capacitação — encaminhe ao Serviço Social.",
      );
    }

    const duplicada = await this.prisma.matricula.findFirst({
      where: { turmaId, fichaId: dto.fichaId, membroId: dto.membroId ?? null },
    });
    if (duplicada) {
      throw new ConflictException("Este aluno já está matriculado nesta turma.");
    }

    const temVaga = turma._count.matriculas < turma.vagasTotais;
    let posicaoEspera: number | null = null;
    if (!temVaga) {
      const naEspera = await this.prisma.matricula.count({
        where: { turmaId, status: StatusMatricula.LISTA_ESPERA },
      });
      posicaoEspera = naEspera + 1;
    }

    const matricula = await this.prisma.matricula.create({
      data: {
        unidadeId: turma.unidadeId,
        turmaId,
        fichaId: dto.fichaId,
        membroId: dto.membroId,
        status: temVaga ? StatusMatricula.ATIVA : StatusMatricula.LISTA_ESPERA,
        posicaoEspera,
        criadoPor: user.id,
      },
      include: {
        ficha: { select: { id: true, protocolo: true, nomeCompleto: true } },
        membro: { select: { id: true, nomeCompleto: true } },
      },
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.CREATE,
      entidade: "Matricula",
      entidadeId: matricula.id,
      metadados: { turmaId, status: matricula.status },
    });

    return matricula;
  }

  async detalhe(user: AuthenticatedUser, id: string) {
    const profissional = await this.profissionais.resolverPorUser(user);
    const turma = await this.prisma.turma.findUnique({
      where: { id },
      include: turmaDetalheInclude,
    });
    if (!turma) throw new NotFoundException("Turma não encontrada");
    // Tenant: dados de alunos só para a unidade da turma (SUPER_ADMIN passa).
    if (
      !user.perfis.includes(Perfil.SUPER_ADMIN) &&
      turma.unidadeId !== profissional.unidadeId
    ) {
      throw new ForbiddenException("Esta turma pertence a outra unidade.");
    }

    const aulasEncerradas = turma.aulas.filter((a) => a.encerradaEm).length;
    const matriculas = turma.matriculas.map(({ presencas, ...m }) => ({
      ...m,
      presencaPct: Number(this.presencaPct(presencas, aulasEncerradas).toFixed(1)),
    }));

    return { ...turma, matriculas, aulasEncerradas };
  }

  /** Encerra a turma e emite certificados para quem atingiu a presença mínima. */
  async encerrar(user: AuthenticatedUser, id: string) {
    const profissional = await this.profissionais.resolverPorUser(user);
    const turma = await this.prisma.turma.findUnique({
      where: { id },
      include: turmaDetalheInclude,
    });
    if (!turma) throw new NotFoundException("Turma não encontrada");
    this.profissionais.assertOwnership(turma.profissionalId, profissional, user);
    if (turma.status === StatusTurma.ENCERRADA) {
      throw new ConflictException("Turma já encerrada.");
    }

    const aulasEncerradas = turma.aulas.filter((a) => a.encerradaEm).length;
    if (aulasEncerradas === 0) {
      throw new BadRequestException(
        "Encerre ao menos uma aula com chamada antes de encerrar a turma.",
      );
    }

    const codigos: string[] = [];
    let evadidas = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const mat of turma.matriculas) {
        if (mat.status !== StatusMatricula.ATIVA) continue;
        const pct = this.presencaPct(mat.presencas, aulasEncerradas);

        if (pct >= turma.curso.presencaMinimaPct) {
          const cert = await tx.certificado.create({
            data: {
              unidadeId: turma.unidadeId,
              matriculaId: mat.id,
              cargaHorariaCumprida: Math.round(
                (turma.curso.cargaHorariaTotal * pct) / 100,
              ),
              presencaPct: new Prisma.Decimal(pct.toFixed(2)),
              emitidoPor: user.id,
            },
          });
          codigos.push(cert.codigoVerificacao);
          await tx.matricula.update({
            where: { id: mat.id },
            data: { status: StatusMatricula.CONCLUIDA },
          });
        } else {
          evadidas++;
          await tx.matricula.update({
            where: { id: mat.id },
            data: { status: StatusMatricula.EVADIDA },
          });
        }
      }
      await tx.turma.update({
        where: { id },
        data: { status: StatusTurma.ENCERRADA, fimEm: new Date() },
      });
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.UPDATE,
      entidade: "Turma",
      entidadeId: id,
      metadados: { acao: "encerramento", certificadosEmitidos: codigos.length, evadidas },
    });

    return { certificadosEmitidos: codigos.length, evadidas, codigos };
  }
}
