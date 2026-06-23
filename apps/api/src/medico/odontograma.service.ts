import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AcaoAuditoria, Prisma, TipoUnidade } from "@ifp/database";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/current-user.decorator";
import {
  normalizarDentes,
  type UpsertOdontogramaDto,
} from "./dto/upsert-odontograma.dto";
import { ProfissionaisService } from "./profissionais.service";

const odontogramaInclude = {
  dentes: { orderBy: { numeroFdi: "asc" } },
} satisfies Prisma.OdontogramaInclude;

const MSG_SELADO = "Atendimento já encerrado — o odontograma é imutável após o selo.";

@Injectable()
export class OdontogramaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly profissionais: ProfissionaisService,
  ) {}

  /** Lê o odontograma de um atendimento (404 se ainda não existe). Audita READ (clínico). */
  async ler(user: AuthenticatedUser, atendimentoId: string) {
    const profissional = await this.profissionais.resolverPorUser(
      user,
      TipoUnidade.MEDICO,
    );
    const atendimento = await this.prisma.atendimento.findUnique({
      where: { id: atendimentoId },
      select: { id: true, profissionalId: true },
    });
    if (!atendimento) throw new NotFoundException("Atendimento não encontrado");
    this.profissionais.assertOwnership(atendimento.profissionalId, profissional, user);

    const odontograma = await this.prisma.odontograma.findUnique({
      where: { atendimentoId },
      include: odontogramaInclude,
    });
    if (!odontograma) {
      throw new NotFoundException("Odontograma ainda não registrado neste atendimento.");
    }

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "Odontograma",
      entidadeId: odontograma.id,
      metadados: { atendimentoId },
    });

    return odontograma;
  }

  /**
   * Upsert do odontograma do atendimento (1-1). Substitui o estado dos dentes
   * enviados e atualiza o plano geral. Idempotente (PUT). Bloqueia se o
   * atendimento já estiver selado (mesma disciplina do prontuário).
   */
  async upsert(
    user: AuthenticatedUser,
    atendimentoId: string,
    dto: UpsertOdontogramaDto,
  ) {
    const profissional = await this.profissionais.resolverPorUser(
      user,
      TipoUnidade.MEDICO,
    );
    const atendimento = await this.prisma.atendimento.findUnique({
      where: { id: atendimentoId },
      select: {
        id: true,
        unidadeId: true,
        fichaId: true,
        membroId: true,
        profissionalId: true,
      },
    });
    if (!atendimento) throw new NotFoundException("Atendimento não encontrado");
    this.profissionais.assertOwnership(atendimento.profissionalId, profissional, user);

    const dentes = normalizarDentes(dto.dentes);

    const odontograma = await this.prisma.$transaction(async (tx) => {
      // Selo sob lock — sem janela para escrever em prontuário selado.
      const [row] = await tx.$queryRaw<{ encerradoEm: Date | null }[]>`
        SELECT "encerradoEm" FROM atendimentos WHERE id = ${atendimentoId} FOR UPDATE
      `;
      if (!row) throw new NotFoundException("Atendimento não encontrado");
      if (row.encerradoEm) throw new ConflictException(MSG_SELADO);

      const base = await tx.odontograma.upsert({
        where: { atendimentoId },
        create: {
          unidadeId: atendimento.unidadeId,
          atendimentoId,
          fichaId: atendimento.fichaId,
          membroId: atendimento.membroId,
          profissionalId: atendimento.profissionalId,
          observacoes: dto.observacoes ?? null,
        },
        update: { observacoes: dto.observacoes ?? null },
      });

      // Substitui o estado de cada dente enviado (idempotente por numeroFdi).
      for (const d of dentes) {
        await tx.denteEstado.upsert({
          where: {
            odontogramaId_numeroFdi: {
              odontogramaId: base.id,
              numeroFdi: d.numeroFdi,
            },
          },
          create: {
            odontogramaId: base.id,
            numeroFdi: d.numeroFdi,
            estado: d.estado,
            procedimento: d.procedimento ?? null,
            observacoes: d.observacoes ?? null,
          },
          update: {
            estado: d.estado,
            procedimento: d.procedimento ?? null,
            observacoes: d.observacoes ?? null,
          },
        });
      }

      return tx.odontograma.findUniqueOrThrow({
        where: { id: base.id },
        include: odontogramaInclude,
      });
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.UPDATE,
      entidade: "Odontograma",
      entidadeId: odontograma.id,
      metadados: { atendimentoId, dentesAtualizados: dentes.length },
    });

    return odontograma;
  }
}
