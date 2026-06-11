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
import type { CriarTreinoDto } from "./dto/criar-treino.dto";
import type { LancarChamadaTreinoDto } from "./dto/lancar-chamada-treino.dto";
import { ProfissionaisService } from "../medico/profissionais.service";

const MSG_TREINO_SELADO = "Treino encerrado — chamada é imutável após o selo.";

@Injectable()
export class TreinosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly profissionais: ProfissionaisService,
  ) {}

  private async carregarTreino(id: string) {
    const treino = await this.prisma.treinoEsportivo.findUnique({
      where: { id },
      include: { turma: true, presencas: true },
    });
    if (!treino) throw new NotFoundException("Treino não encontrado");
    return treino;
  }

  /** Chamada só faz sentido com a turma viva — bloqueia depois do encerramento. */
  private assertTurmaEmAndamento(turma: { status: StatusTurma }) {
    if (turma.status !== StatusTurma.EM_ANDAMENTO) {
      throw new BadRequestException(
        "A turma não está em andamento — chamada e selo de treino estão bloqueados.",
      );
    }
  }

  /** Treino com presenças já lançadas (hidrata a tela de chamada). */
  async detalhe(user: AuthenticatedUser, treinoId: string) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.ESPORTIVO);
    const treino = await this.carregarTreino(treinoId);
    if (
      !user.perfis.includes(Perfil.SUPER_ADMIN) &&
      treino.turma.unidadeId !== profissional.unidadeId
    ) {
      throw new ForbiddenException("Este treino pertence a outra unidade.");
    }

    // Chamada expõe presença de atletas — leitura entra na trilha LGPD.
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "TreinoEsportivo",
      entidadeId: treinoId,
      metadados: { turmaId: treino.turmaId, contexto: "detalhe" },
    });

    return treino;
  }

  async criar(user: AuthenticatedUser, turmaId: string, dto: CriarTreinoDto) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.ESPORTIVO);
    const turma = await this.prisma.turmaEsportiva.findUnique({ where: { id: turmaId } });
    if (!turma) throw new NotFoundException("Turma não encontrada");
    this.profissionais.assertOwnership(turma.profissionalId, profissional, user);
    if (turma.status !== StatusTurma.EM_ANDAMENTO) {
      throw new BadRequestException("A turma não está em andamento.");
    }

    const treino = await this.prisma.treinoEsportivo.create({
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
      entidade: "TreinoEsportivo",
      entidadeId: treino.id,
      metadados: { turmaId },
    });

    return treino;
  }

  /** Lança/atualiza a chamada em lote — idempotente; 409 após o selo do treino. */
  async lancarChamada(user: AuthenticatedUser, treinoId: string, dto: LancarChamadaTreinoDto) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.ESPORTIVO);
    const treino = await this.carregarTreino(treinoId);
    this.profissionais.assertOwnership(treino.turma.profissionalId, profissional, user);
    this.assertTurmaEmAndamento(treino.turma);
    if (treino.encerradoEm) {
      throw new ConflictException(MSG_TREINO_SELADO);
    }

    const ids = dto.itens.map((i) => i.matriculaId);
    const validas = await this.prisma.matriculaEsportiva.count({
      where: { id: { in: ids }, turmaId: treino.turmaId },
    });
    if (validas !== new Set(ids).size) {
      throw new BadRequestException("Há matrículas que não pertencem a esta turma.");
    }

    // Lock da linha do treino: serializa com o encerrar(). Sem ele, uma chamada
    // em voo podia gravar presença DEPOIS do selo (chamada imutável violada).
    await this.prisma.$transaction(async (tx) => {
      const [row] = await tx.$queryRaw<{ encerradoEm: Date | null }[]>`
        SELECT "encerradoEm" FROM treinos_esportivos WHERE id = ${treinoId} FOR UPDATE
      `;
      if (!row) throw new NotFoundException("Treino não encontrado");
      if (row.encerradoEm) throw new ConflictException(MSG_TREINO_SELADO);

      await Promise.all(
        dto.itens.map((item) =>
          tx.presencaTreino.upsert({
            where: { treinoId_matriculaId: { treinoId, matriculaId: item.matriculaId } },
            update: { status: item.status },
            create: { treinoId, matriculaId: item.matriculaId, status: item.status },
          }),
        ),
      );
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.UPDATE,
      entidade: "TreinoEsportivo.chamada",
      entidadeId: treinoId,
      metadados: { lancamentos: dto.itens.length },
    });

    return this.carregarTreino(treinoId);
  }

  async encerrar(user: AuthenticatedUser, treinoId: string) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.ESPORTIVO);
    const treino = await this.carregarTreino(treinoId);
    this.profissionais.assertOwnership(treino.turma.profissionalId, profissional, user);
    this.assertTurmaEmAndamento(treino.turma);
    if (treino.encerradoEm) throw new ConflictException("Treino já encerrado.");
    if (treino.presencas.length === 0) {
      throw new BadRequestException("Lance a chamada antes de encerrar o treino.");
    }

    // updateMany condicional: o WHERE com o selo garante que só um encerramento
    // vence; o write toma o lock da linha e serializa com a chamada em voo.
    const encerrado = await this.prisma.$transaction(async (tx) => {
      const r = await tx.treinoEsportivo.updateMany({
        where: { id: treinoId, encerradoEm: null },
        data: { encerradoEm: new Date() },
      });
      if (r.count === 0) throw new ConflictException("Treino já encerrado.");
      return tx.treinoEsportivo.findUniqueOrThrow({
        where: { id: treinoId },
        include: { presencas: true },
      });
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.UPDATE,
      entidade: "TreinoEsportivo",
      entidadeId: treinoId,
      metadados: { acao: "encerramento" },
    });

    return encerrado;
  }
}
