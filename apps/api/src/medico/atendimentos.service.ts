import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AcaoAuditoria, Prisma, StatusAgendamento, TipoUnidade } from "@ifp/database";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/current-user.decorator";
import type { UpdateSoapDto } from "./dto/update-soap.dto";
import type { UpsertVitaisDto } from "./dto/upsert-vitais.dto";
import { ProfissionaisService } from "./profissionais.service";

const atendimentoInclude = {
  vitais: true,
  agendamento: true,
} satisfies Prisma.AtendimentoInclude;

@Injectable()
export class AtendimentosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly profissionais: ProfissionaisService,
  ) {}

  private async carregar(id: string) {
    const atendimento = await this.prisma.atendimento.findUnique({
      where: { id },
      include: atendimentoInclude,
    });
    if (!atendimento) throw new NotFoundException("Atendimento não encontrado");
    return atendimento;
  }

  private assertEditavel(atendimento: { encerradoEm: Date | null }) {
    if (atendimento.encerradoEm) {
      throw new ConflictException(
        "Atendimento já encerrado — prontuário é imutável após o selo.",
      );
    }
  }

  async salvarSoap(user: AuthenticatedUser, id: string, dto: UpdateSoapDto) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.MEDICO);
    const atendimento = await this.carregar(id);
    this.profissionais.assertOwnership(atendimento.profissionalId, profissional, user);
    this.assertEditavel(atendimento);

    const atualizado = await this.prisma.atendimento.update({
      where: { id },
      data: {
        subjetivo: dto.subjetivo,
        objetivo: dto.objetivo,
        avaliacao: dto.avaliacao,
        plano: dto.plano,
        cid10: dto.cid10,
      },
      include: atendimentoInclude,
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.UPDATE,
      entidade: "Atendimento",
      entidadeId: id,
      metadados: { campos: Object.keys(dto) },
    });

    return atualizado;
  }

  async upsertVitais(user: AuthenticatedUser, id: string, dto: UpsertVitaisDto) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.MEDICO);
    const atendimento = await this.carregar(id);
    this.profissionais.assertOwnership(atendimento.profissionalId, profissional, user);
    this.assertEditavel(atendimento);

    // PUT = substituição completa: campo omitido vira null.
    const valores = {
      pressaoSistolica: dto.pressaoSistolica ?? null,
      pressaoDiastolica: dto.pressaoDiastolica ?? null,
      frequenciaCardiaca: dto.frequenciaCardiaca ?? null,
      frequenciaRespiratoria: dto.frequenciaRespiratoria ?? null,
      temperaturaC:
        dto.temperaturaC !== undefined ? new Prisma.Decimal(dto.temperaturaC) : null,
      saturacaoO2: dto.saturacaoO2 ?? null,
      pesoKg: dto.pesoKg !== undefined ? new Prisma.Decimal(dto.pesoKg) : null,
      alturaCm: dto.alturaCm !== undefined ? new Prisma.Decimal(dto.alturaCm) : null,
      glicemia: dto.glicemia ?? null,
      queixaPrincipal: dto.queixaPrincipal ?? null,
      registradosPor: user.id,
    };

    await this.prisma.sinaisVitais.upsert({
      where: { atendimentoId: id },
      create: { atendimentoId: id, unidadeId: atendimento.unidadeId, ...valores },
      update: valores,
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.UPDATE,
      entidade: "Atendimento.vitais",
      entidadeId: id,
    });

    return this.carregar(id);
  }

  async encerrar(user: AuthenticatedUser, id: string) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.MEDICO);
    const atendimento = await this.carregar(id);
    this.profissionais.assertOwnership(atendimento.profissionalId, profissional, user);
    this.assertEditavel(atendimento);

    if (!atendimento.subjetivo?.trim() || !atendimento.plano?.trim()) {
      throw new BadRequestException(
        "Para selar o atendimento preencha ao menos a queixa (S) e a conduta (P).",
      );
    }

    const selado = await this.prisma.$transaction(async (tx) => {
      const atualizado = await tx.atendimento.update({
        where: { id },
        data: { encerradoEm: new Date() },
        include: atendimentoInclude,
      });
      if (atendimento.agendamentoId) {
        await tx.agendamento.update({
          where: { id: atendimento.agendamentoId },
          data: { status: StatusAgendamento.CONCLUIDO },
        });
      }
      return atualizado;
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.UPDATE,
      entidade: "Atendimento",
      entidadeId: id,
      metadados: { acao: "encerramento" },
    });

    return selado;
  }
}
