import { Injectable } from "@nestjs/common";
import { AcaoAuditoria, Prisma } from "@ifp/database";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/current-user.decorator";
import type { ListarAuditoriaDto } from "./dto/listar-auditoria.dto";

/** Linha da trilha já enriquecida com o nome do ator (para a tela). */
interface LinhaAuditoria {
  id: string;
  acao: AcaoAuditoria;
  entidade: string;
  entidadeId: string | null;
  ator: { id: string; nome: string; email: string } | null;
  ip: string | null;
  metadados: Prisma.JsonValue;
  criadoEm: Date;
}

/**
 * Visualizador da trilha de auditoria (governança LGPD). SUPER_ADMIN apenas
 * (garantido no controller). Só LEITURA/EXPORT — a gravação é do AuditService.
 *
 * Minimização: NÃO devolvemos o userAgent (ruído sem valor de governança) e o
 * próprio acesso à trilha é auditado (READ/EXPORT da entidade "AuditLog").
 */
@Injectable()
export class AuditoriaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Traduz os filtros do DTO em um WHERE do Prisma (período inclusivo). */
  private montarWhere(dto: ListarAuditoriaDto): Prisma.AuditLogWhereInput {
    const where: Prisma.AuditLogWhereInput = {};
    if (dto.ator) where.userId = dto.ator;
    if (dto.acao) where.acao = dto.acao;
    if (dto.entidade) where.entidade = dto.entidade;

    if (dto.de || dto.ate) {
      const criadoEm: Prisma.DateTimeFilter = {};
      if (dto.de) criadoEm.gte = new Date(dto.de);
      if (dto.ate) {
        // "ate" inclui o dia inteiro: fim do dia informado.
        const fim = new Date(dto.ate);
        fim.setHours(23, 59, 59, 999);
        criadoEm.lte = fim;
      }
      where.criadoEm = criadoEm;
    }
    return where;
  }

  /** Filtros aplicados, achatados em JSON simples (para registrar na própria trilha). */
  private filtrosJson(dto: ListarAuditoriaDto): Record<string, string> {
    const f: Record<string, string> = {};
    if (dto.ator) f.ator = dto.ator;
    if (dto.acao) f.acao = dto.acao;
    if (dto.entidade) f.entidade = dto.entidade;
    if (dto.de) f.de = dto.de;
    if (dto.ate) f.ate = dto.ate;
    return f;
  }

  /** Resolve os nomes dos atores em lote (evita N+1). */
  private async enriquecer(
    rows: {
      id: string;
      acao: AcaoAuditoria;
      entidade: string;
      entidadeId: string | null;
      userId: string | null;
      ip: string | null;
      metadados: Prisma.JsonValue;
      criadoEm: Date;
    }[],
  ): Promise<LinhaAuditoria[]> {
    const ids = [...new Set(rows.map((r) => r.userId).filter((x): x is string => !!x))];
    const atores = ids.length
      ? await this.prisma.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, nome: true, email: true },
        })
      : [];
    const porId = new Map(atores.map((a) => [a.id, a]));

    return rows.map((r) => ({
      id: r.id,
      acao: r.acao,
      entidade: r.entidade,
      entidadeId: r.entidadeId,
      ator: r.userId ? (porId.get(r.userId) ?? null) : null,
      ip: r.ip,
      metadados: r.metadados,
      criadoEm: r.criadoEm,
    }));
  }

  async listar(user: AuthenticatedUser, dto: ListarAuditoriaDto) {
    const page = dto.page ?? 1;
    const perPage = dto.perPage ?? 30;
    const where = this.montarWhere(dto);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { criadoEm: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true,
          acao: true,
          entidade: true,
          entidadeId: true,
          userId: true,
          ip: true,
          metadados: true,
          criadoEm: true,
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    // Auditar o acesso à própria trilha (LGPD: quem consultou auditoria, e o filtro).
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "AuditLog",
      metadados: { filtros: this.filtrosJson(dto), total, page, perPage },
    });

    return {
      items: await this.enriquecer(rows),
      pagination: { page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) },
    };
  }

  /** Distintos para popular os selects da tela (entidades auditadas). */
  async facetas() {
    const entidades = await this.prisma.auditLog.findMany({
      distinct: ["entidade"],
      orderBy: { entidade: "asc" },
      select: { entidade: true },
    });
    return {
      acoes: Object.values(AcaoAuditoria),
      entidades: entidades.map((e) => e.entidade),
    };
  }

  /**
   * Exporta a trilha filtrada em CSV (governança). O EXPORT é, ele próprio, um
   * evento auditado (AcaoAuditoria.EXPORT). Teto de 5000 linhas por export.
   */
  async exportarCsv(user: AuthenticatedUser, dto: ListarAuditoriaDto): Promise<string> {
    const where = this.montarWhere(dto);
    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: { criadoEm: "desc" },
      take: 5000,
      select: {
        id: true,
        acao: true,
        entidade: true,
        entidadeId: true,
        userId: true,
        ip: true,
        metadados: true,
        criadoEm: true,
      },
    });
    const linhas = await this.enriquecer(rows);

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.EXPORT,
      entidade: "AuditLog",
      metadados: { filtros: this.filtrosJson(dto), total: linhas.length },
    });

    const cabecalho = ["dataHora", "ator", "email", "acao", "entidade", "entidadeId", "ip"];
    const escapar = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const corpo = linhas.map((l) =>
      [
        l.criadoEm.toISOString(),
        l.ator?.nome ?? "(sistema)",
        l.ator?.email ?? "",
        l.acao,
        l.entidade,
        l.entidadeId ?? "",
        l.ip ?? "",
      ]
        .map(escapar)
        .join(";"),
    );
    return [cabecalho.join(";"), ...corpo].join("\r\n");
  }
}
