import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AcaoAuditoria,
  SentidoCheck,
  StatusDiario,
  StatusElegibilidade,
  TipoUnidade,
} from "@ifp/database";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/current-user.decorator";
import { ProfissionaisService } from "../medico/profissionais.service";
import type { CriarMatriculaInfantilDto } from "./dto/criar-matricula-infantil.dto";
import type { CriarTurmaInfantilDto } from "./dto/criar-turma-infantil.dto";
import { janelaDoDiaSP } from "./dia-util";

/** Estado da criança no dia, derivado do último check (padrão Brightwheel). */
export type EstadoDia = "SEM_CHECKIN" | "PRESENTE" | "SAIU";

const VERSAO_TERMO_VIGENTE = "v1-2026";

@Injectable()
export class TurmasInfantisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly profissionais: ProfissionaisService,
  ) {}

  private estadoDoDia(ultimo?: { sentido: SentidoCheck } | null): EstadoDia {
    if (!ultimo) return "SEM_CHECKIN";
    return ultimo.sentido === SentidoCheck.ENTRADA ? "PRESENTE" : "SAIU";
  }

  async listar(user: AuthenticatedUser) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.EDUCACIONAL);
    const items = await this.prisma.turmaInfantil.findMany({
      where: { unidadeId: profissional.unidadeId, ativa: true },
      orderBy: { nome: "asc" },
      include: {
        educador: { include: { user: { select: { nome: true } } } },
        _count: { select: { matriculas: { where: { ativa: true } } } },
      },
    });
    return { items };
  }

  async criar(user: AuthenticatedUser, dto: CriarTurmaInfantilDto) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.EDUCACIONAL);
    if (dto.faixaEtariaMax < dto.faixaEtariaMin) {
      throw new BadRequestException("Faixa etária máxima menor que a mínima.");
    }

    const turma = await this.prisma.turmaInfantil.create({
      data: {
        unidadeId: profissional.unidadeId,
        nome: dto.nome,
        faixaEtariaMin: dto.faixaEtariaMin,
        faixaEtariaMax: dto.faixaEtariaMax,
        capacidade: dto.capacidade,
        profissionalId: profissional.id,
      },
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.CREATE,
      entidade: "TurmaInfantil",
      entidadeId: turma.id,
      metadados: { nome: turma.nome },
    });

    return turma;
  }

  /**
   * Matricula a criança: exige elegibilidade APROVADA da família na unidade
   * (regra de ouro) e o consentimento LGPD Art. 14 explícito do responsável.
   * As autorizações de imagem são colhidas no mesmo fluxo (default: negado).
   */
  async matricular(user: AuthenticatedUser, turmaId: string, dto: CriarMatriculaInfantilDto) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.EDUCACIONAL);

    if (!dto.consentimentoLgpd) {
      throw new BadRequestException(
        "A matrícula exige o consentimento LGPD (Art. 14) do responsável legal.",
      );
    }

    const turma = await this.prisma.turmaInfantil.findFirst({
      where: { id: turmaId, unidadeId: profissional.unidadeId, ativa: true },
      select: { id: true, capacidade: true },
    });
    if (!turma) throw new NotFoundException("Turma não encontrada nesta unidade");

    const elegivel = await this.prisma.elegibilidadePorUnidade.findFirst({
      where: {
        fichaId: dto.fichaId,
        unidadeId: profissional.unidadeId,
        status: StatusElegibilidade.APROVADO,
      },
      select: { id: true },
    });
    if (!elegivel) {
      throw new BadRequestException(
        "Esta família não tem elegibilidade APROVADA nesta unidade — encaminhe ao Serviço Social.",
      );
    }

    const crianca = await this.prisma.membroFamiliar.findFirst({
      where: { id: dto.membroId, fichaId: dto.fichaId },
      select: { id: true },
    });
    if (!crianca) {
      throw new BadRequestException("A criança não pertence a esta família.");
    }

    // Lock na turma (disciplina da Capacitação): capacidade nunca estoura
    // sob matrículas concorrentes.
    const matricula = await this.prisma.$transaction(async (tx) => {
      const [lockada] = await tx.$queryRaw<{ capacidade: number }[]>`
        SELECT capacidade FROM turmas_infantis WHERE id = ${turmaId} FOR UPDATE
      `;
      if (!lockada) throw new NotFoundException("Turma não encontrada");

      const duplicada = await tx.matriculaInfantil.findUnique({
        where: { turmaId_membroId: { turmaId, membroId: dto.membroId } },
        select: { id: true, ativa: true },
      });
      if (duplicada?.ativa) {
        throw new ConflictException("Esta criança já está matriculada nesta turma.");
      }

      const ativas = await tx.matriculaInfantil.count({
        where: { turmaId, ativa: true },
      });
      if (ativas >= lockada.capacidade) {
        throw new BadRequestException("A turma está lotada.");
      }

      if (duplicada) {
        return tx.matriculaInfantil.update({
          where: { id: duplicada.id },
          data: { ativa: true, consentimentoLgpdEm: new Date() },
        });
      }
      return tx.matriculaInfantil.create({
        data: {
          unidadeId: profissional.unidadeId,
          turmaId,
          fichaId: dto.fichaId,
          membroId: dto.membroId,
          consentimentoLgpdEm: new Date(),
          criadoPor: user.id,
        },
      });
    });

    // Autorizações de imagem colhidas na matrícula (ausente = negado, que já
    // é o default do modelo — só gravamos o que foi declarado).
    for (const item of dto.autorizacoesImagem ?? []) {
      await this.prisma.autorizacaoImagem.upsert({
        where: {
          membroId_escopo_versaoTermo: {
            membroId: dto.membroId,
            escopo: item.escopo,
            versaoTermo: VERSAO_TERMO_VIGENTE,
          },
        },
        update: { concedido: item.concedido, revogadoEm: null, revogadoPor: null },
        create: {
          fichaId: dto.fichaId,
          membroId: dto.membroId,
          escopo: item.escopo,
          concedido: item.concedido,
          versaoTermo: VERSAO_TERMO_VIGENTE,
          criadoPor: user.id,
        },
      });
    }

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.CREATE,
      entidade: "MatriculaInfantil",
      entidadeId: matricula.id,
      metadados: {
        turmaId,
        membroId: dto.membroId,
        autorizacoesImagem: (dto.autorizacoesImagem ?? []).length,
      },
    });

    return matricula;
  }

  /** Turma com as crianças e o estado do dia (sem check-in / presente / saiu). */
  async detalhe(user: AuthenticatedUser, turmaId: string, data?: string) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.EDUCACIONAL);
    const turma = await this.prisma.turmaInfantil.findUnique({
      where: { id: turmaId },
      include: {
        educador: { include: { user: { select: { nome: true } } } },
        matriculas: {
          where: { ativa: true },
          include: {
            crianca: {
              select: {
                id: true,
                nomeCompleto: true,
                dataNascimento: true,
                alergias: { where: { ativa: true } },
              },
            },
            ficha: { select: { id: true, protocolo: true, nomeCompleto: true } },
          },
        },
      },
    });
    if (!turma) throw new NotFoundException("Turma não encontrada");
    if (turma.unidadeId !== profissional.unidadeId) {
      throw new ForbiddenException("Esta turma pertence a outra unidade.");
    }

    const { inicio, fim, dia } = janelaDoDiaSP(data);
    const membroIds = turma.matriculas.map((m) => m.membroId);
    const checksDoDia = await this.prisma.checkInOut.findMany({
      where: { membroId: { in: membroIds }, ocorridoEm: { gte: inicio, lt: fim } },
      orderBy: { ocorridoEm: "asc" },
      include: { autorizado: { select: { id: true, nome: true, parentesco: true } } },
    });
    const diariosDoDia = await this.prisma.diarioDia.findMany({
      where: { membroId: { in: membroIds }, data: janelaDoDiaSP(data).dataDb },
      select: { membroId: true, status: true, id: true },
    });

    // Dados de crianças — leitura entra na trilha LGPD.
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "TurmaInfantil",
      entidadeId: turmaId,
      metadados: { contexto: "detalhe", criancas: membroIds.length },
    });

    const matriculas = turma.matriculas.map((m) => {
      const checks = checksDoDia.filter((c) => c.membroId === m.membroId);
      const diario = diariosDoDia.find((d) => d.membroId === m.membroId);
      return {
        ...m,
        estadoDia: this.estadoDoDia(checks[checks.length - 1]),
        checksDoDia: checks,
        diarioDoDia: diario ?? null,
      };
    });

    return { ...turma, matriculas, dia };
  }

  /** KPIs do painel da unidade (densidade média-alta — pesquisa). */
  async resumo(user: AuthenticatedUser) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.EDUCACIONAL);
    const unidadeId = profissional.unidadeId;
    const { inicio, fim, dataDb } = janelaDoDiaSP();

    const [matriculados, checksHoje, diariosFechados, diariosAbertos, criticos] =
      await Promise.all([
        this.prisma.matriculaInfantil.count({ where: { unidadeId, ativa: true } }),
        this.prisma.checkInOut.findMany({
          where: { unidadeId, ocorridoEm: { gte: inicio, lt: fim } },
          orderBy: { ocorridoEm: "asc" },
          select: { membroId: true, sentido: true },
        }),
        this.prisma.diarioDia.count({
          where: { unidadeId, data: dataDb, status: StatusDiario.FECHADO },
        }),
        this.prisma.diarioDia.count({
          where: { unidadeId, data: dataDb, status: StatusDiario.ABERTO },
        }),
        this.prisma.comunicado.findMany({
          where: { unidadeId, critico: true },
          include: { _count: { select: { leituras: true } } },
        }),
      ]);

    // Presentes agora = último check do dia é ENTRADA.
    const ultimoPorCrianca = new Map<string, SentidoCheck>();
    for (const c of checksHoje) ultimoPorCrianca.set(c.membroId, c.sentido);
    const presentesAgora = [...ultimoPorCrianca.values()].filter(
      (s) => s === SentidoCheck.ENTRADA,
    ).length;

    const criticosSemLeitura = criticos.filter((c) => c._count.leituras === 0).length;

    return {
      matriculados,
      presentesAgora,
      diariosFechados,
      diariosAbertos,
      criticosSemLeitura,
    };
  }
}
