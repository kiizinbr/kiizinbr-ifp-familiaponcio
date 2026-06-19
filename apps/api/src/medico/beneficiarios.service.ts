import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AcaoAuditoria, StatusElegibilidade, TipoUnidade } from "@ifp/database";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { ProfissionaisService } from "./profissionais.service";
import type { AuthenticatedUser } from "../auth/current-user.decorator";
import type { AtualizarAlergiaDto, RegistrarAlergiaDto } from "./dto/alergia.dto";
import type { AtualizarCondicaoDto, RegistrarCondicaoDto } from "./dto/condicao.dto";

@Injectable()
export class BeneficiariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly profissionais: ProfissionaisService,
  ) {}

  /** Garante que a ficha é elegível APROVADA na unidade do médico (senão 404 anti-enum). */
  private async assertElegivel(fichaId: string, unidadeId: string) {
    const ok = await this.prisma.elegibilidadePorUnidade.findFirst({
      where: { fichaId, unidadeId, status: StatusElegibilidade.APROVADO },
      select: { id: true },
    });
    if (!ok) throw new NotFoundException("Beneficiário não encontrado nesta unidade");
  }

  private async assertMembroDaFicha(membroId: string, fichaId: string) {
    const membro = await this.prisma.membroFamiliar.findFirst({
      where: { id: membroId, fichaId },
      select: { id: true },
    });
    if (!membro) throw new BadRequestException("O dependente não pertence a esta família.");
  }

  /** Beneficiários elegíveis APROVADOS no médico (busca opcional por nome). */
  async listar(user: AuthenticatedUser, q?: string) {
    const prof = await this.profissionais.resolverPorUser(user, TipoUnidade.MEDICO);
    const termo = q?.trim();

    const elegiveis = await this.prisma.elegibilidadePorUnidade.findMany({
      where: {
        unidadeId: prof.unidadeId,
        status: StatusElegibilidade.APROVADO,
        ficha: {
          ativa: true,
          ...(termo && termo.length >= 2
            ? { nomeCompleto: { contains: termo, mode: "insensitive" } }
            : {}),
        },
      },
      orderBy: { ficha: { nomeCompleto: "asc" } },
      take: 50,
      select: {
        ficha: {
          select: {
            id: true,
            protocolo: true,
            nomeCompleto: true,
            dataNascimento: true,
            _count: { select: { alergias: { where: { ativa: true } } } },
          },
        },
      },
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "FichaCidada",
      metadados: { contexto: "medico.beneficiarios", resultados: elegiveis.length },
    });

    return {
      items: elegiveis.map((e) => ({
        id: e.ficha.id,
        protocolo: e.ficha.protocolo,
        nomeCompleto: e.ficha.nomeCompleto,
        dataNascimento: e.ficha.dataNascimento,
        alergiasAtivas: e.ficha._count.alergias,
      })),
    };
  }

  /** Ficha clínica: dados + alergias + condições + histórico de atendimentos selados. */
  async fichaClinica(user: AuthenticatedUser, fichaId: string) {
    const prof = await this.profissionais.resolverPorUser(user, TipoUnidade.MEDICO);
    await this.assertElegivel(fichaId, prof.unidadeId);

    const ficha = await this.prisma.fichaCidada.findUnique({
      where: { id: fichaId },
      select: {
        id: true,
        protocolo: true,
        nomeCompleto: true,
        dataNascimento: true,
        telefone: true,
        membros: {
          select: { id: true, nomeCompleto: true, dataNascimento: true, parentesco: true },
        },
        alergias: {
          orderBy: [{ ativa: "desc" }, { criadoEm: "desc" }],
          select: { id: true, descricao: true, gravidade: true, ativa: true, membroId: true },
        },
        condicoesCronicas: {
          orderBy: [{ ativa: "desc" }, { criadoEm: "desc" }],
          select: {
            id: true,
            descricao: true,
            cid10: true,
            observacoes: true,
            ativa: true,
            membroId: true,
          },
        },
      },
    });
    if (!ficha) throw new NotFoundException("Beneficiário não encontrado");

    const atendimentos = await this.prisma.atendimento.findMany({
      where: { fichaId, unidadeId: prof.unidadeId, encerradoEm: { not: null } },
      orderBy: { encerradoEm: "desc" },
      take: 50,
      select: {
        id: true,
        encerradoEm: true,
        subjetivo: true,
        avaliacao: true,
        plano: true,
        cid10: true,
        agendamentoId: true,
        membro: { select: { id: true, nomeCompleto: true } },
        profissional: { select: { user: { select: { nome: true } } } },
      },
    });

    // Leitura de prontuário/histórico clínico — trilha LGPD.
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "FichaCidada",
      entidadeId: fichaId,
      metadados: { contexto: "medico.fichaClinica", atendimentos: atendimentos.length },
    });

    return { ...ficha, atendimentos };
  }

  async adicionarAlergia(user: AuthenticatedUser, fichaId: string, dto: RegistrarAlergiaDto) {
    const prof = await this.profissionais.resolverPorUser(user, TipoUnidade.MEDICO);
    await this.assertElegivel(fichaId, prof.unidadeId);
    if (dto.membroId) await this.assertMembroDaFicha(dto.membroId, fichaId);

    const alergia = await this.prisma.alergia.create({
      data: {
        fichaId,
        membroId: dto.membroId,
        descricao: dto.descricao.trim(),
        gravidade: dto.gravidade,
        registradaPor: user.id,
      },
    });
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.CREATE,
      entidade: "Alergia",
      entidadeId: alergia.id,
      metadados: { fichaId },
    });
    return alergia;
  }

  async atualizarAlergia(user: AuthenticatedUser, alergiaId: string, dto: AtualizarAlergiaDto) {
    const prof = await this.profissionais.resolverPorUser(user, TipoUnidade.MEDICO);
    const alergia = await this.prisma.alergia.findUnique({ where: { id: alergiaId } });
    if (!alergia) throw new NotFoundException("Alergia não encontrada");
    await this.assertElegivel(alergia.fichaId, prof.unidadeId);

    const atualizada = await this.prisma.alergia.update({
      where: { id: alergiaId },
      data: {
        ...(dto.descricao ? { descricao: dto.descricao.trim() } : {}),
        ...(dto.gravidade ? { gravidade: dto.gravidade } : {}),
        ...(dto.ativa != null ? { ativa: dto.ativa } : {}),
      },
    });
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.UPDATE,
      entidade: "Alergia",
      entidadeId: alergiaId,
      metadados: { campos: Object.keys(dto) },
    });
    return atualizada;
  }

  async adicionarCondicao(user: AuthenticatedUser, fichaId: string, dto: RegistrarCondicaoDto) {
    const prof = await this.profissionais.resolverPorUser(user, TipoUnidade.MEDICO);
    await this.assertElegivel(fichaId, prof.unidadeId);
    if (dto.membroId) await this.assertMembroDaFicha(dto.membroId, fichaId);

    const condicao = await this.prisma.condicaoCronica.create({
      data: {
        fichaId,
        membroId: dto.membroId,
        descricao: dto.descricao.trim(),
        cid10: dto.cid10,
        observacoes: dto.observacoes,
      },
    });
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.CREATE,
      entidade: "CondicaoCronica",
      entidadeId: condicao.id,
      metadados: { fichaId },
    });
    return condicao;
  }

  async atualizarCondicao(
    user: AuthenticatedUser,
    condicaoId: string,
    dto: AtualizarCondicaoDto,
  ) {
    const prof = await this.profissionais.resolverPorUser(user, TipoUnidade.MEDICO);
    const condicao = await this.prisma.condicaoCronica.findUnique({ where: { id: condicaoId } });
    if (!condicao) throw new NotFoundException("Condição não encontrada");
    await this.assertElegivel(condicao.fichaId, prof.unidadeId);

    const atualizada = await this.prisma.condicaoCronica.update({
      where: { id: condicaoId },
      data: {
        ...(dto.descricao ? { descricao: dto.descricao.trim() } : {}),
        ...(dto.cid10 !== undefined ? { cid10: dto.cid10 } : {}),
        ...(dto.observacoes !== undefined ? { observacoes: dto.observacoes } : {}),
        ...(dto.ativa != null ? { ativa: dto.ativa } : {}),
      },
    });
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.UPDATE,
      entidade: "CondicaoCronica",
      entidadeId: condicaoId,
      metadados: { campos: Object.keys(dto) },
    });
    return atualizada;
  }

  /** Prontuários selados do profissional logado (o que ESTE médico atendeu). */
  async prontuarios(user: AuthenticatedUser) {
    const prof = await this.profissionais.resolverPorUser(user, TipoUnidade.MEDICO);
    const items = await this.prisma.atendimento.findMany({
      where: { profissionalId: prof.id, encerradoEm: { not: null } },
      orderBy: { encerradoEm: "desc" },
      take: 100,
      select: {
        id: true,
        encerradoEm: true,
        avaliacao: true,
        plano: true,
        cid10: true,
        agendamentoId: true,
        ficha: { select: { id: true, protocolo: true, nomeCompleto: true } },
        membro: { select: { nomeCompleto: true } },
      },
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "Atendimento",
      metadados: { contexto: "medico.prontuarios", total: items.length },
    });

    return { items };
  }

  /** Indicadores do consultório do profissional (totais, comparecimento, série). */
  async indicadores(user: AuthenticatedUser) {
    const prof = await this.profissionais.resolverPorUser(user, TipoUnidade.MEDICO);

    const [atendimentosSelados, agend, beneficiarios] = await Promise.all([
      this.prisma.atendimento.count({
        where: { profissionalId: prof.id, encerradoEm: { not: null } },
      }),
      this.prisma.agendamento.groupBy({
        by: ["status"],
        where: { profissionalId: prof.id },
        _count: { _all: true },
        orderBy: { status: "asc" },
      }),
      this.prisma.elegibilidadePorUnidade.count({
        where: { unidadeId: prof.unidadeId, status: StatusElegibilidade.APROVADO },
      }),
    ]);

    const porStatus: Record<string, number> = {};
    for (const g of agend) porStatus[g.status] = g._count._all;
    const concluidos = porStatus.CONCLUIDO ?? 0;
    const faltas = porStatus.FALTOU ?? 0;
    const taxaComparecimento =
      concluidos + faltas > 0
        ? Math.round((concluidos / (concluidos + faltas)) * 100)
        : null;

    const porMes = await this.prisma.$queryRaw<{ mes: string; total: number }[]>`
      SELECT to_char(date_trunc('month', "encerradoEm"), 'YYYY-MM') AS mes, count(*)::int AS total
      FROM atendimentos
      WHERE "profissionalId" = ${prof.id} AND "encerradoEm" IS NOT NULL
        AND "encerradoEm" >= now() - interval '6 months'
      GROUP BY 1 ORDER BY 1
    `;

    return { atendimentosSelados, beneficiarios, porStatus, taxaComparecimento, porMes };
  }
}
