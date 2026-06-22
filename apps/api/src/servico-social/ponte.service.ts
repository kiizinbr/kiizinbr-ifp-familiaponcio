import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  AcaoAuditoria,
  PrioridadeSinal,
  Prisma,
  StatusSinalizacao,
} from "@ifp/database";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/current-user.decorator";
import type { CriarSinalizacaoDto } from "./dto/criar-sinalizacao.dto";

const sinalizacaoInclude = {
  ficha: { select: { id: true, protocolo: true, nomeCompleto: true } },
  membro: { select: { id: true, nomeCompleto: true } },
  unidadeOrigem: { select: { slug: true, nome: true } },
} satisfies Prisma.SinalizacaoPonteInclude;

interface ListarParams {
  status?: StatusSinalizacao;
  prioridade?: PrioridadeSinal;
  page?: number;
  perPage?: number;
}

/**
 * Ponte — sinalizações que os profissionais (médico/educador/...) enviam ao
 * Serviço Social. Consumo (listar/atender) é do social; a criação é dos
 * profissionais (RBAC sobrescrito no método do controller).
 */
@Injectable()
export class PonteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listar(user: AuthenticatedUser, { status, prioridade, page = 1, perPage = 20 }: ListarParams) {
    const where: Prisma.SinalizacaoPonteWhereInput = {
      ...(status ? { status } : {}),
      ...(prioridade ? { prioridade } : {}),
    };
    const [rows, total, pendentes, urgentes] = await this.prisma.$transaction([
      this.prisma.sinalizacaoPonte.findMany({
        where,
        include: sinalizacaoInclude,
        // PENDENTE antes de ATENDIDA; depois URGENTE primeiro; mais novas no topo.
        orderBy: [{ status: "asc" }, { prioridade: "desc" }, { criadoEm: "desc" }],
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.sinalizacaoPonte.count({ where }),
      this.prisma.sinalizacaoPonte.count({ where: { status: StatusSinalizacao.PENDENTE } }),
      this.prisma.sinalizacaoPonte.count({
        where: { status: StatusSinalizacao.PENDENTE, prioridade: PrioridadeSinal.URGENTE },
      }),
    ]);

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "SinalizacaoPonte",
      metadados: { contexto: "lista", resultados: rows.length },
    });

    return {
      items: rows,
      kpis: { pendentes, urgentes },
      pagination: { page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) },
    };
  }

  async detalhe(user: AuthenticatedUser, id: string) {
    const sinal = await this.prisma.sinalizacaoPonte.findUnique({
      where: { id },
      include: sinalizacaoInclude,
    });
    if (!sinal) throw new NotFoundException("Sinalização não encontrada.");
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "SinalizacaoPonte",
      entidadeId: id,
    });
    return sinal;
  }

  async marcarAtendida(user: AuthenticatedUser, id: string) {
    const r = await this.prisma.sinalizacaoPonte.updateMany({
      where: { id, status: StatusSinalizacao.PENDENTE },
      data: { status: StatusSinalizacao.ATENDIDA, respondidoPor: user.id, respondidoEm: new Date() },
    });
    if (r.count === 0) {
      throw new ConflictException("Sinalização já foi atendida.");
    }
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.UPDATE,
      entidade: "SinalizacaoPonte",
      entidadeId: id,
      metadados: { acao: "marcar-atendida" },
    });
    return this.detalhe(user, id);
  }

  /** Criada pelo profissional (médico/educador) e enviada ao Serviço Social. */
  async criar(user: AuthenticatedUser, dto: CriarSinalizacaoDto) {
    const ficha = await this.prisma.fichaCidada.findUnique({
      where: { id: dto.fichaId },
      select: { id: true },
    });
    if (!ficha) throw new NotFoundException("Ficha não encontrada.");

    if (dto.membroId) {
      const membro = await this.prisma.membroFamiliar.findFirst({
        where: { id: dto.membroId, fichaId: dto.fichaId },
        select: { id: true },
      });
      if (!membro) throw new BadRequestException("O membro informado não pertence a esta ficha.");
    }

    const origem = await this.prisma.unidade.findUnique({
      where: { slug: dto.unidadeOrigemSlug },
      select: { id: true },
    });
    if (!origem) throw new NotFoundException("Unidade de origem não encontrada.");

    const sinal = await this.prisma.sinalizacaoPonte.create({
      data: {
        fichaId: dto.fichaId,
        membroId: dto.membroId ?? null,
        unidadeOrigemId: origem.id,
        descricao: dto.descricao,
        criadoPor: user.id,
        ...(dto.tipo ? { tipo: dto.tipo } : {}),
        ...(dto.prioridade ? { prioridade: dto.prioridade } : {}),
      },
      include: sinalizacaoInclude,
    });
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.CREATE,
      entidade: "SinalizacaoPonte",
      entidadeId: sinal.id,
      metadados: { fichaId: dto.fichaId, origem: dto.unidadeOrigemSlug },
    });
    return sinal;
  }
}
