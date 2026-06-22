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
import type { CreatePrescricaoDto } from "./dto/create-prescricao.dto";
import { verificarConflitoAlergia } from "./alergia-check";
import { ProfissionaisService } from "./profissionais.service";

const atendimentoInclude = {
  vitais: true,
  agendamento: true,
} satisfies Prisma.AtendimentoInclude;

const MSG_SELADO = "Atendimento já encerrado — prontuário é imutável após o selo.";

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
      throw new ConflictException(MSG_SELADO);
    }
  }

  async salvarSoap(user: AuthenticatedUser, id: string, dto: UpdateSoapDto) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.MEDICO);
    const atendimento = await this.carregar(id);
    this.profissionais.assertOwnership(atendimento.profissionalId, profissional, user);
    this.assertEditavel(atendimento);

    // Guard atômico: o WHERE inclui o selo — se outro request encerrou entre a
    // checagem acima e o write, nada é atualizado e devolvemos 409 (não há
    // janela para alterar prontuário selado).
    const r = await this.prisma.atendimento.updateMany({
      where: { id, encerradoEm: null },
      data: {
        subjetivo: dto.subjetivo,
        objetivo: dto.objetivo,
        avaliacao: dto.avaliacao,
        plano: dto.plano,
        cid10: dto.cid10,
      },
    });
    if (r.count === 0) throw new ConflictException(MSG_SELADO);

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.UPDATE,
      entidade: "Atendimento",
      entidadeId: id,
      metadados: { campos: Object.keys(dto) },
    });

    return this.carregar(id);
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

    // Upsert não tem WHERE condicional — o lock da linha do atendimento
    // serializa com o encerrar(): ou os vitais entram antes do selo, ou o
    // selo vence e devolvemos 409.
    await this.prisma.$transaction(async (tx) => {
      const [row] = await tx.$queryRaw<{ encerradoEm: Date | null }[]>`
        SELECT "encerradoEm" FROM atendimentos WHERE id = ${id} FOR UPDATE
      `;
      if (!row) throw new NotFoundException("Atendimento não encontrado");
      if (row.encerradoEm) throw new ConflictException(MSG_SELADO);

      await tx.sinaisVitais.upsert({
        where: { atendimentoId: id },
        create: { atendimentoId: id, unidadeId: atendimento.unidadeId, ...valores },
        update: valores,
      });
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
      // updateMany condicional: dois selos simultâneos → o segundo conta 0 e
      // recebe 409 (mesma disciplina do salvarSoap).
      const r = await tx.atendimento.updateMany({
        where: { id, encerradoEm: null },
        data: { encerradoEm: new Date() },
      });
      if (r.count === 0) throw new ConflictException(MSG_SELADO);

      if (atendimento.agendamentoId) {
        await tx.agendamento.update({
          where: { id: atendimento.agendamentoId },
          data: { status: StatusAgendamento.CONCLUIDO },
        });
      }
      return tx.atendimento.findUniqueOrThrow({
        where: { id },
        include: atendimentoInclude,
      });
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

  /**
   * Emite uma prescrição para o atendimento, com BLOQUEIO de alergia
   * server-side (fonte da verdade). Política: se algum medicamento casa com
   * uma alergia ATIVA do paciente e o corpo NÃO traz `override.motivo`,
   * devolve 409 com a lista de conflitos (o front exige justificativa).
   * Prescrever apesar do conflito grava `alergiaOverride` + motivo (auditoria).
   */
  async prescrever(user: AuthenticatedUser, id: string, dto: CreatePrescricaoDto) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.MEDICO);
    const atendimento = await this.carregar(id);
    this.profissionais.assertOwnership(atendimento.profissionalId, profissional, user);
    this.assertEditavel(atendimento); // prescreve-se durante o atendimento aberto

    // Alergias ATIVAS do PACIENTE deste atendimento: titular (membroId null)
    // ou o dependente atendido (membroId preenchido).
    const alergias = await this.prisma.alergia.findMany({
      where: { ativa: true, fichaId: atendimento.fichaId, membroId: atendimento.membroId },
      select: { id: true, descricao: true, gravidade: true },
    });

    const conflitos = verificarConflitoAlergia(
      dto.itens.map((i) => ({ medicamento: i.medicamento })),
      alergias,
    );
    const motivoOverride = dto.override?.motivo?.trim() || null;

    // BLOQUEIO: conflito sem override consciente → 409 com a lista.
    if (conflitos.length > 0 && !motivoOverride) {
      throw new ConflictException({
        code: "ALERGIA_CONFLITO",
        message:
          "Conflito de alergia: há medicamento prescrito que casa com uma alergia ATIVA do paciente. Para prescrever mesmo assim, justifique.",
        conflitos,
      });
    }

    const comConflito = conflitos.length > 0;
    const medicamentosEmConflito = new Set(conflitos.map((c) => c.medicamento));

    const prescricao = await this.prisma.$transaction(async (tx) => {
      // Re-checa o selo sob lock — sem janela para prescrever em prontuário selado.
      const [row] = await tx.$queryRaw<{ encerradoEm: Date | null }[]>`
        SELECT "encerradoEm" FROM atendimentos WHERE id = ${id} FOR UPDATE
      `;
      if (!row) throw new NotFoundException("Atendimento não encontrado");
      if (row.encerradoEm) throw new ConflictException(MSG_SELADO);

      return tx.prescricao.create({
        data: {
          unidadeId: atendimento.unidadeId,
          atendimentoId: id,
          fichaId: atendimento.fichaId,
          membroId: atendimento.membroId,
          profissionalId: atendimento.profissionalId,
          observacoes: dto.observacoes,
          alergiaOverride: comConflito,
          alergiaOverrideMotivo: comConflito ? motivoOverride : null,
          itens: {
            create: dto.itens.map((i) => ({
              medicamento: i.medicamento,
              posologia: i.posologia,
              conflitoAlergia: medicamentosEmConflito.has(i.medicamento),
            })),
          },
        },
        include: { itens: true },
      });
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.CREATE,
      entidade: "Prescricao",
      entidadeId: prescricao.id,
      metadados: {
        atendimentoId: id,
        itens: dto.itens.length,
        alergiaOverride: comConflito,
        ...(comConflito
          ? {
              conflitos: conflitos.map((c) => c.alergiaDescricao),
              motivoOverride,
            }
          : {}),
      },
    });

    return prescricao;
  }
}
