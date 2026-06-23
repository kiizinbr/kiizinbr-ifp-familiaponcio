import { Injectable } from "@nestjs/common";
import { AcaoAuditoria, Prisma } from "@ifp/database";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/current-user.decorator";

interface ListarParams {
  unidadeSlug?: string;
  apenasCriticos?: boolean;
  page?: number;
  perPage?: number;
}

/**
 * Rastreamento transversal de ENTREGA/LEITURA de comunicados (governança).
 * SUPER_ADMIN apenas (controller). Agrega sobre o que já existe (Comunicado +
 * ComunicadoLeitura): para cada comunicado calcula o público-alvo (famílias da
 * turma, ou da unidade quando geral) e quantas confirmaram leitura.
 */
@Injectable()
export class ComunicadosEntregaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Tamanho do público-alvo de um comunicado (fichas distintas). */
  private async publicoAlvo(unidadeId: string, turmaId: string | null): Promise<number> {
    // Comunicado de turma → famílias matriculadas naquela turma.
    // Comunicado geral → famílias com matrícula ativa em qualquer turma da unidade.
    const matriculas = await this.prisma.matriculaInfantil.findMany({
      where: {
        ativa: true,
        ...(turmaId ? { turmaId } : { unidadeId }),
      },
      select: { fichaId: true },
    });
    return new Set(matriculas.map((m) => m.fichaId)).size;
  }

  async listar(user: AuthenticatedUser, params: ListarParams) {
    const page = params.page ?? 1;
    const perPage = params.perPage ?? 20;

    const where: Prisma.ComunicadoWhereInput = {
      ...(params.apenasCriticos ? { critico: true } : {}),
      ...(params.unidadeSlug ? { unidade: { slug: params.unidadeSlug } } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.comunicado.findMany({
        where,
        orderBy: { criadoEm: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true,
          titulo: true,
          critico: true,
          criadoEm: true,
          unidadeId: true,
          turmaId: true,
          unidade: { select: { slug: true, nome: true } },
          turma: { select: { id: true, nome: true } },
          _count: { select: { leituras: true } },
        },
      }),
      this.prisma.comunicado.count({ where }),
    ]);

    const items = await Promise.all(
      rows.map(async (c) => {
        const alvo = await this.publicoAlvo(c.unidadeId, c.turmaId);
        const lidos = c._count.leituras;
        const pct = alvo > 0 ? Math.round((lidos / alvo) * 100) : 0;
        return {
          id: c.id,
          titulo: c.titulo,
          critico: c.critico,
          criadoEm: c.criadoEm,
          unidade: c.unidade,
          turma: c.turma,
          publicoAlvo: alvo,
          lidos,
          pendentes: Math.max(0, alvo - lidos),
          coberturaPct: pct,
        };
      }),
    );

    // KPIs do topo: total enviados, críticos e cobertura média (LGPD: agregado).
    const criticos = items.filter((i) => i.critico).length;
    const coberturaMedia = items.length
      ? Math.round(items.reduce((s, i) => s + i.coberturaPct, 0) / items.length)
      : 0;

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "ComunicadoLeitura",
      metadados: { total, page, perPage, unidade: params.unidadeSlug ?? null },
    });

    return {
      items,
      kpis: { total, criticos, coberturaMedia },
      pagination: { page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) },
    };
  }
}
