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
  StatusMatricula,
  StatusPresenca,
  StatusTurma,
} from "@ifp/database";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/current-user.decorator";
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
