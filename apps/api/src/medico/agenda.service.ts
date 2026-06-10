import { Injectable, NotFoundException } from "@nestjs/common";
import { AcaoAuditoria, Prisma, StatusAgendamento } from "@ifp/database";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/current-user.decorator";
import { ProfissionaisService } from "./profissionais.service";

const agendaInclude = {
  ficha: {
    select: {
      id: true,
      protocolo: true,
      nomeCompleto: true,
      cpf: true,
      dataNascimento: true,
    },
  },
  membro: true,
  atendimento: { select: { id: true, encerradoEm: true } },
} satisfies Prisma.AgendamentoInclude;

/** Payload completo da prancha: ficha com histórico clínico + elegibilidades + draft. */
const pranchaInclude = {
  ficha: {
    include: {
      alergias: { where: { ativa: true } },
      condicoesCronicas: { where: { ativa: true } },
      elegibilidades: { include: { unidade: true } },
    },
  },
  membro: true,
  atendimento: { include: { vitais: true } },
} satisfies Prisma.AgendamentoInclude;

@Injectable()
export class AgendaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly profissionais: ProfissionaisService,
  ) {}

  /** Janela [00:00 do dia, 00:00 do dia seguinte) no horário local. */
  private janelaDoDia(data?: string) {
    const inicio = data ? new Date(`${data}T00:00:00`) : new Date();
    if (!data) inicio.setHours(0, 0, 0, 0);
    const fim = new Date(inicio);
    fim.setDate(fim.getDate() + 1);
    return { inicio, fim };
  }

  async listarDia(user: AuthenticatedUser, data?: string) {
    const profissional = await this.profissionais.resolverPorUser(user);
    const { inicio, fim } = this.janelaDoDia(data);

    const items = await this.prisma.agendamento.findMany({
      where: {
        profissionalId: profissional.id,
        inicioEm: { gte: inicio, lt: fim },
      },
      orderBy: { inicioEm: "asc" },
      include: agendaInclude,
    });

    return { items, dia: inicio.toISOString().slice(0, 10) };
  }

  async prancha(user: AuthenticatedUser, agendamentoId: string) {
    const profissional = await this.profissionais.resolverPorUser(user);

    const agendamento = await this.prisma.agendamento.findUnique({
      where: { id: agendamentoId },
      include: pranchaInclude,
    });
    if (!agendamento) throw new NotFoundException("Agendamento não encontrado");
    this.profissionais.assertOwnership(agendamento.profissionalId, profissional, user);

    // Prontuário é dado sensível — leitura entra na trilha LGPD.
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "Atendimento",
      entidadeId: agendamento.atendimento?.id ?? null,
      metadados: { agendamentoId, fichaId: agendamento.fichaId },
    });

    return agendamento;
  }

  /** Cria o atendimento do agendamento (idempotente: se já existe, retorna o existente). */
  async iniciar(user: AuthenticatedUser, agendamentoId: string) {
    const profissional = await this.profissionais.resolverPorUser(user);

    const agendamento = await this.prisma.agendamento.findUnique({
      where: { id: agendamentoId },
      include: { atendimento: { include: { vitais: true } } },
    });
    if (!agendamento) throw new NotFoundException("Agendamento não encontrado");
    this.profissionais.assertOwnership(agendamento.profissionalId, profissional, user);

    if (agendamento.atendimento) return agendamento.atendimento;

    const atendimento = await this.prisma.$transaction(async (tx) => {
      const criado = await tx.atendimento.create({
        data: {
          unidadeId: agendamento.unidadeId,
          fichaId: agendamento.fichaId,
          membroId: agendamento.membroId,
          profissionalId: agendamento.profissionalId,
          agendamentoId: agendamento.id,
        },
        include: { vitais: true },
      });
      await tx.agendamento.update({
        where: { id: agendamento.id },
        data: { status: StatusAgendamento.EM_ATENDIMENTO },
      });
      return criado;
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.CREATE,
      entidade: "Atendimento",
      entidadeId: atendimento.id,
      metadados: { agendamentoId, fichaId: agendamento.fichaId },
    });

    return atendimento;
  }
}
