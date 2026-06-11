import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AcaoAuditoria, Perfil, StatusTurma, TipoUnidade } from "@ifp/database";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/current-user.decorator";
import type { CriarAulaDto } from "./dto/criar-aula.dto";
import type { LancarChamadaDto } from "./dto/lancar-chamada.dto";
import { ProfissionaisService } from "../medico/profissionais.service";

const MSG_AULA_SELADA = "Aula encerrada — chamada é imutável após o selo.";

@Injectable()
export class AulasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly profissionais: ProfissionaisService,
  ) {}

  private async carregarAula(id: string) {
    const aula = await this.prisma.aula.findUnique({
      where: { id },
      include: { turma: true, presencas: true },
    });
    if (!aula) throw new NotFoundException("Aula não encontrada");
    return aula;
  }

  /** Presença/chamada só fazem sentido com a turma viva — bloqueia depois do encerramento. */
  private assertTurmaEmAndamento(turma: { status: StatusTurma }) {
    if (turma.status !== StatusTurma.EM_ANDAMENTO) {
      throw new BadRequestException(
        "A turma não está em andamento — chamada e selo de aula estão bloqueados.",
      );
    }
  }

  /** Aula com presenças já lançadas (hidrata a tela de chamada). */
  async detalhe(user: AuthenticatedUser, aulaId: string) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.CAPACITACAO);
    const aula = await this.carregarAula(aulaId);
    if (
      !user.perfis.includes(Perfil.SUPER_ADMIN) &&
      aula.turma.unidadeId !== profissional.unidadeId
    ) {
      throw new ForbiddenException("Esta aula pertence a outra unidade.");
    }

    // Chamada expõe presença de alunos — leitura entra na trilha LGPD.
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "Aula",
      entidadeId: aulaId,
      metadados: { turmaId: aula.turmaId, contexto: "detalhe" },
    });

    return aula;
  }

  async criar(user: AuthenticatedUser, turmaId: string, dto: CriarAulaDto) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.CAPACITACAO);
    const turma = await this.prisma.turma.findUnique({ where: { id: turmaId } });
    if (!turma) throw new NotFoundException("Turma não encontrada");
    this.profissionais.assertOwnership(turma.profissionalId, profissional, user);
    if (turma.status !== StatusTurma.EM_ANDAMENTO) {
      throw new BadRequestException("A turma não está em andamento.");
    }

    const aula = await this.prisma.aula.create({
      data: {
        unidadeId: turma.unidadeId,
        turmaId: turma.id,
        data: new Date(dto.data),
        conteudo: dto.conteudo,
        profissionalId: profissional.id,
      },
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.CREATE,
      entidade: "Aula",
      entidadeId: aula.id,
      metadados: { turmaId },
    });

    return aula;
  }

  /** Lança/atualiza a chamada em lote — idempotente; 409 após o selo da aula. */
  async lancarChamada(user: AuthenticatedUser, aulaId: string, dto: LancarChamadaDto) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.CAPACITACAO);
    const aula = await this.carregarAula(aulaId);
    this.profissionais.assertOwnership(aula.turma.profissionalId, profissional, user);
    this.assertTurmaEmAndamento(aula.turma);
    if (aula.encerradaEm) {
      throw new ConflictException(MSG_AULA_SELADA);
    }

    const ids = dto.itens.map((i) => i.matriculaId);
    const validas = await this.prisma.matricula.count({
      where: { id: { in: ids }, turmaId: aula.turmaId },
    });
    if (validas !== new Set(ids).size) {
      throw new BadRequestException("Há matrículas que não pertencem a esta turma.");
    }

    // Lock da linha da aula: serializa com o encerrar(). Sem ele, uma chamada
    // em voo podia gravar presença DEPOIS do selo (chamada imutável violada).
    await this.prisma.$transaction(async (tx) => {
      const [row] = await tx.$queryRaw<{ encerradaEm: Date | null }[]>`
        SELECT "encerradaEm" FROM aulas WHERE id = ${aulaId} FOR UPDATE
      `;
      if (!row) throw new NotFoundException("Aula não encontrada");
      if (row.encerradaEm) throw new ConflictException(MSG_AULA_SELADA);

      await Promise.all(
        dto.itens.map((item) =>
          tx.presenca.upsert({
            where: { aulaId_matriculaId: { aulaId, matriculaId: item.matriculaId } },
            update: { status: item.status },
            create: { aulaId, matriculaId: item.matriculaId, status: item.status },
          }),
        ),
      );
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.UPDATE,
      entidade: "Aula.chamada",
      entidadeId: aulaId,
      metadados: { lancamentos: dto.itens.length },
    });

    return this.carregarAula(aulaId);
  }

  async encerrar(user: AuthenticatedUser, aulaId: string) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.CAPACITACAO);
    const aula = await this.carregarAula(aulaId);
    this.profissionais.assertOwnership(aula.turma.profissionalId, profissional, user);
    this.assertTurmaEmAndamento(aula.turma);
    if (aula.encerradaEm) throw new ConflictException("Aula já encerrada.");
    if (aula.presencas.length === 0) {
      throw new BadRequestException("Lance a chamada antes de encerrar a aula.");
    }

    // updateMany condicional: o WHERE com o selo garante que só um encerramento
    // vence; o write toma o lock da linha e serializa com a chamada em voo.
    const encerrada = await this.prisma.$transaction(async (tx) => {
      const r = await tx.aula.updateMany({
        where: { id: aulaId, encerradaEm: null },
        data: { encerradaEm: new Date() },
      });
      if (r.count === 0) throw new ConflictException("Aula já encerrada.");
      return tx.aula.findUniqueOrThrow({
        where: { id: aulaId },
        include: { presencas: true },
      });
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.UPDATE,
      entidade: "Aula",
      entidadeId: aulaId,
      metadados: { acao: "encerramento" },
    });

    return encerrada;
  }
}
