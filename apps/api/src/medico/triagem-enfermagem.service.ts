import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AcaoAuditoria, Prisma, StatusAgendamento, TipoUnidade } from "@ifp/database";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/current-user.decorator";
import type { UpsertTriagemEnfermagemDto } from "./dto/upsert-triagem-enfermagem.dto";
import { ProfissionaisService } from "./profissionais.service";

/**
 * Triagem de enfermagem (acolhimento na chegada). A enfermagem é um Profissional
 * lotado na unidade MÉDICO — por isso resolvemos via ProfissionaisService (mesma
 * parede de tenant do atendimento). É DADO CLÍNICO: leitura e escrita são auditadas.
 *
 * A triagem pendura no AGENDAMENTO (1-1), não no atendimento: ela é colhida ANTES
 * de o médico iniciar o atendimento, e o médico apenas a lê na abertura da prancha.
 */
@Injectable()
export class TriagemEnfermagemService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly profissionais: ProfissionaisService,
  ) {}

  /** Carrega o agendamento garantindo que pertence à unidade médica do profissional. */
  private async carregarAgendamento(unidadeId: string, agendamentoId: string) {
    const ag = await this.prisma.agendamento.findUnique({
      where: { id: agendamentoId },
      select: {
        id: true,
        unidadeId: true,
        status: true,
        chegouEm: true,
        fichaId: true,
      },
    });
    if (!ag || ag.unidadeId !== unidadeId) {
      throw new NotFoundException("Agendamento não encontrado");
    }
    return ag;
  }

  /** Enfermagem registra/atualiza a triagem do agendamento (upsert 1-1). */
  async salvar(
    user: AuthenticatedUser,
    agendamentoId: string,
    dto: UpsertTriagemEnfermagemDto,
  ) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.MEDICO);
    const ag = await this.carregarAgendamento(profissional.unidadeId, agendamentoId);

    if (
      ag.status === StatusAgendamento.CANCELADO ||
      ag.status === StatusAgendamento.FALTOU
    ) {
      throw new BadRequestException(
        "Não dá para triar um agendamento cancelado ou faltoso.",
      );
    }
    if (!ag.chegouEm) {
      throw new BadRequestException(
        "Marque a chegada do paciente na recepção antes de fazer a triagem.",
      );
    }

    // PUT = substituição completa: campo de vital omitido vira null.
    const valores = {
      classificacaoRisco: dto.classificacaoRisco,
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
      dorEscala: dto.dorEscala ?? null,
      queixaPrincipal: dto.queixaPrincipal ?? null,
      observacoes: dto.observacoes ?? null,
      registradaPor: user.id,
    };

    const triagem = await this.prisma.triagemEnfermagem.upsert({
      where: { agendamentoId },
      create: { agendamentoId, unidadeId: profissional.unidadeId, ...valores },
      update: valores,
    });

    // Escrita de dado clínico (vitais + classificação de risco) → trilha LGPD.
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.UPDATE,
      entidade: "TriagemEnfermagem",
      entidadeId: triagem.id,
      metadados: {
        agendamentoId,
        fichaId: ag.fichaId,
        classificacaoRisco: dto.classificacaoRisco,
      },
    });

    return triagem;
  }

  /** Leitura da triagem do agendamento (enfermagem/médico). */
  async obter(user: AuthenticatedUser, agendamentoId: string) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.MEDICO);
    const ag = await this.carregarAgendamento(profissional.unidadeId, agendamentoId);

    const triagem = await this.prisma.triagemEnfermagem.findUnique({
      where: { agendamentoId },
    });
    if (!triagem) {
      throw new NotFoundException("Este agendamento ainda não tem triagem de enfermagem.");
    }

    // Leitura de dado clínico → trilha LGPD.
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "TriagemEnfermagem",
      entidadeId: triagem.id,
      metadados: { agendamentoId, fichaId: ag.fichaId },
    });

    return triagem;
  }
}
