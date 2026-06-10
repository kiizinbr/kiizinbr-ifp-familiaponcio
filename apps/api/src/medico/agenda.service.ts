import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AcaoAuditoria, Prisma, StatusAgendamento } from "@ifp/database";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/current-user.decorator";
import type { CriarAgendamentoDto } from "./dto/criar-agendamento.dto";
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

  /** Busca enxuta de pacientes para agendar — só o necessário (privacidade). */
  async buscarFichas(user: AuthenticatedUser, q?: string) {
    await this.profissionais.resolverPorUser(user);
    const termo = q?.trim();
    if (!termo || termo.length < 2) return { items: [] };

    const digitos = termo.replace(/\D/g, "");
    const pat = `%${termo}%`;
    // unaccent: "joao" encontra "João" (extensão criada na migration 20260610150000)
    const linhas = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM fichas_cidadas
      WHERE ativa = true AND (
        unaccent(lower("nomeCompleto")) LIKE unaccent(lower(${pat}))
        OR protocolo LIKE ${`%${termo.toUpperCase()}%`}
        OR (length(${digitos}) >= 3 AND cpf LIKE ${`%${digitos}%`})
      )
      ORDER BY "nomeCompleto" ASC
      LIMIT 10
    `;
    if (linhas.length === 0) return { items: [] };

    const items = await this.prisma.fichaCidada.findMany({
      where: { id: { in: linhas.map((l) => l.id) } },
      orderBy: { nomeCompleto: "asc" },
      select: {
        id: true,
        protocolo: true,
        nomeCompleto: true,
        dataNascimento: true,
        membros: { select: { id: true, nomeCompleto: true, parentesco: true } },
      },
    });
    return { items };
  }

  /** Agenda um paciente para o profissional logado. */
  async criarAgendamento(user: AuthenticatedUser, dto: CriarAgendamentoDto) {
    const profissional = await this.profissionais.resolverPorUser(user);

    const ficha = await this.prisma.fichaCidada.findUnique({
      where: { id: dto.fichaId },
      select: { id: true },
    });
    if (!ficha) throw new NotFoundException("Ficha do paciente não encontrada");

    if (dto.membroId) {
      const membro = await this.prisma.membroFamiliar.findFirst({
        where: { id: dto.membroId, fichaId: dto.fichaId },
        select: { id: true },
      });
      if (!membro) {
        throw new BadRequestException("O dependente não pertence a esta família.");
      }
    }

    const inicio = new Date(dto.inicioEm);
    const fim = dto.fimEm
      ? new Date(dto.fimEm)
      : new Date(inicio.getTime() + 30 * 60 * 1000);
    if (fim <= inicio) {
      throw new BadRequestException("O fim do agendamento deve ser depois do início.");
    }

    const agendamento = await this.prisma.agendamento.create({
      data: {
        unidadeId: profissional.unidadeId,
        fichaId: dto.fichaId,
        membroId: dto.membroId,
        profissionalId: profissional.id,
        inicioEm: inicio,
        fimEm: fim,
        status: StatusAgendamento.CONFIRMADO,
        motivo: dto.motivo,
        criadoPor: user.id,
      },
      include: agendaInclude,
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.CREATE,
      entidade: "Agendamento",
      entidadeId: agendamento.id,
      metadados: { fichaId: dto.fichaId, inicioEm: inicio.toISOString() },
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
