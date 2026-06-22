import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AcaoAuditoria,
  PrioridadeSinal,
  Prisma,
  StatusElegibilidade,
  StatusEncaminhamento,
} from "@ifp/database";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/current-user.decorator";
import type { CriarEncaminhamentoDto } from "./dto/criar-encaminhamento.dto";
import type { RecusarEncaminhamentoDto } from "./dto/recusar-encaminhamento.dto";

const encaminhamentoInclude = {
  ficha: { select: { id: true, protocolo: true, nomeCompleto: true } },
  unidadeOrigem: { select: { slug: true, nome: true } },
  unidadeDestino: { select: { slug: true, nome: true } },
} satisfies Prisma.EncaminhamentoInclude;

interface ListarParams {
  status?: StatusEncaminhamento;
  prioridade?: PrioridadeSinal;
  page?: number;
  perPage?: number;
}

const DIA_MS = 86_400_000;

/**
 * Serviço Social — Encaminhamentos entre unidades (workflow Aceitar/Recusar).
 * Papel CROSS-UNIDADE (sem tenant); RBAC SERVICO_SOCIAL no controller.
 */
@Injectable()
export class EncaminhamentosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listar(user: AuthenticatedUser, { status, prioridade, page = 1, perPage = 20 }: ListarParams) {
    const where: Prisma.EncaminhamentoWhereInput = {
      ...(status ? { status } : {}),
      ...(prioridade ? { prioridade } : {}),
    };
    const semana = new Date(Date.now() - 7 * DIA_MS);
    const mes = new Date(Date.now() - 30 * DIA_MS);

    const [rows, total, pendentes, aceitosSemana, recusadosMes, resolvidos] =
      await this.prisma.$transaction([
        this.prisma.encaminhamento.findMany({
          where,
          include: encaminhamentoInclude,
          // URGENTE primeiro; dentro da prioridade, os mais antigos na frente.
          orderBy: [{ prioridade: "desc" }, { criadoEm: "asc" }],
          skip: (page - 1) * perPage,
          take: perPage,
        }),
        this.prisma.encaminhamento.count({ where }),
        this.prisma.encaminhamento.count({ where: { status: StatusEncaminhamento.PENDENTE } }),
        this.prisma.encaminhamento.count({
          where: { status: StatusEncaminhamento.ACEITO, respondidoEm: { gte: semana } },
        }),
        this.prisma.encaminhamento.count({
          where: { status: StatusEncaminhamento.RECUSADO, respondidoEm: { gte: mes } },
        }),
        this.prisma.encaminhamento.findMany({
          where: { respondidoEm: { gte: mes } },
          select: { criadoEm: true, respondidoEm: true },
        }),
      ]);

    // Tempo médio de resposta (dias, 1 casa) nos últimos 30 dias.
    const tempoMedioDias = resolvidos.length
      ? Math.round(
          (resolvidos.reduce(
            (s, r) => s + (r.respondidoEm!.getTime() - r.criadoEm.getTime()),
            0,
          ) /
            resolvidos.length /
            DIA_MS) *
            10,
        ) / 10
      : 0;

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "Encaminhamento",
      metadados: { contexto: "lista", resultados: rows.length },
    });

    return {
      items: rows,
      kpis: { pendentes, aceitosSemana, recusadosMes, tempoMedioDias },
      pagination: { page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) },
    };
  }

  async criar(user: AuthenticatedUser, dto: CriarEncaminhamentoDto) {
    const ficha = await this.prisma.fichaCidada.findUnique({
      where: { id: dto.fichaId },
      select: { id: true },
    });
    if (!ficha) throw new NotFoundException("Ficha não encontrada.");

    const [origem, destino] = await Promise.all([
      this.prisma.unidade.findUnique({ where: { slug: dto.unidadeOrigemSlug }, select: { id: true } }),
      this.prisma.unidade.findUnique({ where: { slug: dto.unidadeDestinoSlug }, select: { id: true } }),
    ]);
    if (!origem) throw new NotFoundException("Unidade de origem não encontrada.");
    if (!destino) throw new NotFoundException("Unidade de destino não encontrada.");
    if (origem.id === destino.id) {
      throw new BadRequestException("Origem e destino devem ser unidades diferentes.");
    }

    // Regra de negócio: só encaminha quem já foi aprovado na unidade de origem.
    const aprovada = await this.prisma.elegibilidadePorUnidade.findFirst({
      where: { fichaId: dto.fichaId, unidadeId: origem.id, status: StatusElegibilidade.APROVADO },
      select: { id: true },
    });
    if (!aprovada) {
      throw new ConflictException(
        "A família precisa estar APROVADA na unidade de origem para ser encaminhada.",
      );
    }

    const encaminhamento = await this.prisma.encaminhamento.create({
      data: {
        fichaId: dto.fichaId,
        unidadeOrigemId: origem.id,
        unidadeDestinoId: destino.id,
        motivo: dto.motivo,
        criadoPor: user.id,
        ...(dto.prioridade ? { prioridade: dto.prioridade } : {}),
      },
      include: encaminhamentoInclude,
    });
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.CREATE,
      entidade: "Encaminhamento",
      entidadeId: encaminhamento.id,
      metadados: { fichaId: dto.fichaId, origem: dto.unidadeOrigemSlug, destino: dto.unidadeDestinoSlug },
    });
    return encaminhamento;
  }

  async detalhe(user: AuthenticatedUser, id: string) {
    const encaminhamento = await this.prisma.encaminhamento.findUnique({
      where: { id },
      include: encaminhamentoInclude,
    });
    if (!encaminhamento) throw new NotFoundException("Encaminhamento não encontrado.");
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "Encaminhamento",
      entidadeId: id,
    });
    return encaminhamento;
  }

  async aceitar(user: AuthenticatedUser, id: string) {
    const r = await this.prisma.encaminhamento.updateMany({
      where: { id, status: StatusEncaminhamento.PENDENTE },
      data: { status: StatusEncaminhamento.ACEITO, respondidoPor: user.id, respondidoEm: new Date() },
    });
    if (r.count === 0) {
      throw new ConflictException("Encaminhamento não está pendente (já respondido).");
    }
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.UPDATE,
      entidade: "Encaminhamento",
      entidadeId: id,
      metadados: { acao: "aceitar" },
    });
    return this.detalhe(user, id);
  }

  async recusar(user: AuthenticatedUser, id: string, dto: RecusarEncaminhamentoDto) {
    const r = await this.prisma.encaminhamento.updateMany({
      where: { id, status: StatusEncaminhamento.PENDENTE },
      data: {
        status: StatusEncaminhamento.RECUSADO,
        justificativaResposta: dto.justificativaResposta,
        respondidoPor: user.id,
        respondidoEm: new Date(),
      },
    });
    if (r.count === 0) {
      throw new ConflictException("Encaminhamento não está pendente (já respondido).");
    }
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.UPDATE,
      entidade: "Encaminhamento",
      entidadeId: id,
      metadados: { acao: "recusar" },
    });
    return this.detalhe(user, id);
  }

  /** Timeline de encaminhamentos de uma ficha (mais recentes primeiro). */
  async historico(user: AuthenticatedUser, fichaId: string) {
    const items = await this.prisma.encaminhamento.findMany({
      where: { fichaId },
      include: encaminhamentoInclude,
      orderBy: { criadoEm: "desc" },
    });
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "Encaminhamento",
      metadados: { contexto: "historico", fichaId, resultados: items.length },
    });
    return { items };
  }
}
