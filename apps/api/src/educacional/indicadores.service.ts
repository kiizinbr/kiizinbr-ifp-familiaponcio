import { Injectable } from "@nestjs/common";
import { AcaoAuditoria, StatusDiario, TipoUnidade } from "@ifp/database";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/current-user.decorator";
import { ProfissionaisService } from "../medico/profissionais.service";
import { janelaDoDiaSP } from "./dia-util";

/**
 * Indicadores da creche (dashboard read-only): presença dos últimos 7 dias,
 * fechamento dos diários do dia e ocupação por turma. Só agregados (sem PII no
 * corpo), mas a leitura entra na trilha LGPD — derivam de dado de menores.
 */
@Injectable()
export class IndicadoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly profissionais: ProfissionaisService,
  ) {}

  async indicadores(user: AuthenticatedUser) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.EDUCACIONAL);
    const unidadeId = profissional.unidadeId;
    const { dataDb } = janelaDoDiaSP();

    // --- Presença por dia (últimos 7 dias civis no fuso do negócio) ---
    // "Presente" no dia = a criança teve ao menos uma ENTRADA naquele dia.
    // ocorridoEm é timestamp SEM fuso (instante UTC). O Brasil é -03:00 fixo
    // (sem horário de verão desde 2019): subtrair 3h converte o instante UTC
    // no dia CIVIL de São Paulo — mesma decisão de offset fixo do dia-util.ts.
    // (Não usar `AT TIME ZONE` num timestamp naive: ele *interpreta* o valor
    // como local e converteria no sentido errado.)
    const presencaPorDia = await this.prisma.$queryRaw<{ dia: string; presentes: number }[]>`
      SELECT to_char(d, 'YYYY-MM-DD') AS dia,
             count(DISTINCT c."membroId")::int AS presentes
      FROM generate_series(
             (now() - interval '3 hours')::date - interval '6 days',
             (now() - interval '3 hours')::date,
             interval '1 day'
           ) AS d
      LEFT JOIN checkins_saidas c
        ON c."unidadeId" = ${unidadeId}
       AND c.sentido = 'ENTRADA'
       AND (c."ocorridoEm" - interval '3 hours')::date = d::date
      GROUP BY d ORDER BY d
    `;

    // --- Diários do dia: abertos × fechados (taxa de fechamento) ---
    const [diariosFechados, diariosAbertos, matriculadosAtivos] = await Promise.all([
      this.prisma.diarioDia.count({
        where: { unidadeId, data: dataDb, status: StatusDiario.FECHADO },
      }),
      this.prisma.diarioDia.count({
        where: { unidadeId, data: dataDb, status: StatusDiario.ABERTO },
      }),
      this.prisma.matriculaInfantil.count({ where: { unidadeId, ativa: true } }),
    ]);
    const totalDiarios = diariosFechados + diariosAbertos;
    const taxaFechamento =
      totalDiarios > 0 ? Math.round((diariosFechados / totalDiarios) * 100) : null;

    // --- Ocupação por turma (matriculados ativos / capacidade) ---
    const turmas = await this.prisma.turmaInfantil.findMany({
      where: { unidadeId, ativa: true },
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        capacidade: true,
        _count: { select: { matriculas: { where: { ativa: true } } } },
      },
    });
    const ocupacaoPorTurma = turmas.map((t) => ({
      turmaId: t.id,
      nome: t.nome,
      matriculados: t._count.matriculas,
      capacidade: t.capacidade,
      pct: t.capacidade > 0 ? Math.round((t._count.matriculas / t.capacidade) * 100) : null,
    }));
    const capacidadeTotal = turmas.reduce((s, t) => s + t.capacidade, 0);
    const ocupacaoGeral =
      capacidadeTotal > 0 ? Math.round((matriculadosAtivos / capacidadeTotal) * 100) : null;

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "TurmaInfantil",
      metadados: { contexto: "educacional.indicadores" },
    });

    return {
      presencaPorDia,
      diarios: { abertos: diariosAbertos, fechados: diariosFechados, taxaFechamento },
      ocupacao: {
        matriculados: matriculadosAtivos,
        capacidade: capacidadeTotal,
        pct: ocupacaoGeral,
      },
      ocupacaoPorTurma,
    };
  }
}
