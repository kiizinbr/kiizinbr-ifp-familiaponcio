import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AcaoAuditoria,
  Perfil,
  Prisma,
  StatusElegibilidade,
  StatusMatricula,
  StatusTurma,
  TipoUnidade,
} from "@ifp/database";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/current-user.decorator";
import type { CriarMatriculaEsportivaDto } from "./dto/criar-matricula-esportiva.dto";
import type { CriarTurmaEsportivaDto } from "./dto/criar-turma-esportiva.dto";
import { ProfissionaisService } from "../medico/profissionais.service";

const turmaEsportivaDetalheInclude = {
  modalidade: true,
  instrutor: { include: { user: { select: { nome: true } } } },
  matriculas: {
    include: {
      ficha: { select: { id: true, protocolo: true, nomeCompleto: true } },
      membro: { select: { id: true, nomeCompleto: true, dataNascimento: true } },
      graduacoes: { orderBy: { concedidaEm: "asc" as const } },
    },
  },
} satisfies Prisma.TurmaEsportivaInclude;

@Injectable()
export class TurmasEsportivasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly profissionais: ProfissionaisService,
  ) {}

  async listar(user: AuthenticatedUser) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.ESPORTIVO);
    const items = await this.prisma.turmaEsportiva.findMany({
      where: { unidadeId: profissional.unidadeId },
      orderBy: { criadoEm: "desc" },
      include: {
        modalidade: true,
        _count: { select: { matriculas: true } },
      },
    });
    return { items };
  }

  /** Modalidades ativas da unidade (para o formulário de nova turma). */
  async modalidades(user: AuthenticatedUser) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.ESPORTIVO);
    const items = await this.prisma.modalidade.findMany({
      where: { unidadeId: profissional.unidadeId, ativo: true },
      orderBy: { nome: "asc" },
      include: { _count: { select: { turmas: true } } },
    });
    return { items };
  }

  /** KPIs da unidade (dashboard). */
  async resumo(user: AuthenticatedUser) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.ESPORTIVO);
    const unidadeId = profissional.unidadeId;
    const [turmasEmAndamento, atletasAtivos, graduacoesConcedidas, listaEspera] =
      await this.prisma.$transaction([
        this.prisma.turmaEsportiva.count({
          where: { unidadeId, status: StatusTurma.EM_ANDAMENTO },
        }),
        this.prisma.matriculaEsportiva.count({
          where: { unidadeId, status: StatusMatricula.ATIVA },
        }),
        this.prisma.graduacao.count({ where: { unidadeId } }),
        this.prisma.matriculaEsportiva.count({
          where: { unidadeId, status: StatusMatricula.LISTA_ESPERA },
        }),
      ]);
    return { turmasEmAndamento, atletasAtivos, graduacoesConcedidas, listaEspera };
  }

  /** Fichas APROVADAS no Esportivo (para o formulário de matrícula). */
  async fichasElegiveis(user: AuthenticatedUser, q?: string) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.ESPORTIVO);
    const termo = q?.trim();
    if (!termo || termo.length < 2) return { items: [] };

    // unaccent: "joao" encontra "João" (regra de ouro continua no JOIN de elegibilidade)
    const linhas = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT f.id FROM fichas_cidadas f
      JOIN elegibilidades e ON e."fichaId" = f.id
        AND e."unidadeId" = ${profissional.unidadeId}
        AND e.status = 'APROVADO'::"StatusElegibilidade"
      WHERE f.ativa = true
        AND unaccent(lower(f."nomeCompleto")) LIKE unaccent(lower(${`%${termo}%`}))
      ORDER BY f."nomeCompleto" ASC
      LIMIT 10
    `;

    // Busca lê dado pessoal — entra na trilha LGPD mesmo quando vazia.
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "FichaCidada",
      metadados: { contexto: "esportivo.fichasElegiveis", resultados: linhas.length },
    });

    if (linhas.length === 0) return { items: [] };

    const items = await this.prisma.fichaCidada.findMany({
      where: { id: { in: linhas.map((l) => l.id) } },
      orderBy: { nomeCompleto: "asc" },
      select: {
        id: true,
        protocolo: true,
        nomeCompleto: true,
        membros: { select: { id: true, nomeCompleto: true, parentesco: true } },
      },
    });
    return { items };
  }

  /** Cria uma turma; o profissional logado é o instrutor responsável. */
  async criar(user: AuthenticatedUser, dto: CriarTurmaEsportivaDto) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.ESPORTIVO);

    const modalidade = await this.prisma.modalidade.findFirst({
      where: { id: dto.modalidadeId, unidadeId: profissional.unidadeId, ativo: true },
    });
    if (!modalidade) throw new NotFoundException("Modalidade não encontrada nesta unidade");

    if (
      dto.faixaEtariaMin != null &&
      dto.faixaEtariaMax != null &&
      dto.faixaEtariaMin > dto.faixaEtariaMax
    ) {
      throw new BadRequestException("Faixa etária mínima maior que a máxima.");
    }

    const codigoExiste = await this.prisma.turmaEsportiva.findUnique({
      where: { codigo: dto.codigo },
      select: { id: true },
    });
    if (codigoExiste) {
      throw new ConflictException(`Já existe uma turma com o código ${dto.codigo}.`);
    }

    const turma = await this.prisma.turmaEsportiva.create({
      data: {
        unidadeId: profissional.unidadeId,
        modalidadeId: modalidade.id,
        codigo: dto.codigo,
        profissionalId: profissional.id,
        diasHorario: dto.diasHorario,
        local: dto.local,
        faixaEtariaMin: dto.faixaEtariaMin,
        faixaEtariaMax: dto.faixaEtariaMax,
        inicioEm: new Date(dto.inicioEm),
        vagasTotais: dto.vagasTotais,
        status: StatusTurma.EM_ANDAMENTO,
      },
      include: { modalidade: true, _count: { select: { matriculas: true } } },
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.CREATE,
      entidade: "TurmaEsportiva",
      entidadeId: turma.id,
      metadados: { codigo: turma.codigo, modalidade: modalidade.nome },
    });

    return turma;
  }

  /** Matricula respeitando a regra de ouro (elegibilidade APROVADA) e as vagas. */
  async matricular(user: AuthenticatedUser, turmaId: string, dto: CriarMatriculaEsportivaDto) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.ESPORTIVO);
    const turma = await this.prisma.turmaEsportiva.findUnique({
      where: { id: turmaId },
      select: { id: true, unidadeId: true, profissionalId: true, status: true },
    });
    if (!turma) throw new NotFoundException("Turma não encontrada");
    this.profissionais.assertOwnership(turma.profissionalId, profissional, user);
    if (turma.status === StatusTurma.ENCERRADA) {
      throw new BadRequestException("A turma já foi encerrada.");
    }

    // Regra de ouro: só matricula quem o Serviço Social aprovou para o Esportivo.
    const elegivel = await this.prisma.elegibilidadePorUnidade.findFirst({
      where: {
        fichaId: dto.fichaId,
        unidadeId: turma.unidadeId,
        status: StatusElegibilidade.APROVADO,
      },
    });
    if (!elegivel) {
      throw new BadRequestException(
        "Esta família não tem elegibilidade APROVADA no Esportivo — encaminhe ao Serviço Social.",
      );
    }

    // Lock da linha da turma: matrículas concorrentes serializam aqui — mata o
    // overbooking, a posição de espera duplicada e a matrícula dupla do titular
    // (o unique composto não cobre membroId NULL). Mesmo desenho da Capacitação.
    const matricula = await this.prisma.$transaction(async (tx) => {
      const [lockada] = await tx.$queryRaw<{ vagasTotais: number; status: string }[]>`
        SELECT "vagasTotais", status FROM turmas_esportivas WHERE id = ${turmaId} FOR UPDATE
      `;
      if (!lockada) throw new NotFoundException("Turma não encontrada");
      if (lockada.status === StatusTurma.ENCERRADA) {
        throw new BadRequestException("A turma já foi encerrada.");
      }

      const duplicada = await tx.matriculaEsportiva.findFirst({
        where: { turmaId, fichaId: dto.fichaId, membroId: dto.membroId ?? null },
        select: { id: true },
      });
      if (duplicada) {
        throw new ConflictException("Este atleta já está matriculado nesta turma.");
      }

      const ativas = await tx.matriculaEsportiva.count({
        where: { turmaId, status: StatusMatricula.ATIVA },
      });
      const temVaga = ativas < lockada.vagasTotais;
      let posicaoEspera: number | null = null;
      if (!temVaga) {
        const naEspera = await tx.matriculaEsportiva.count({
          where: { turmaId, status: StatusMatricula.LISTA_ESPERA },
        });
        posicaoEspera = naEspera + 1;
      }

      return tx.matriculaEsportiva.create({
        data: {
          unidadeId: turma.unidadeId,
          turmaId,
          fichaId: dto.fichaId,
          membroId: dto.membroId,
          status: temVaga ? StatusMatricula.ATIVA : StatusMatricula.LISTA_ESPERA,
          posicaoEspera,
          criadoPor: user.id,
        },
        include: {
          ficha: { select: { id: true, protocolo: true, nomeCompleto: true } },
          membro: { select: { id: true, nomeCompleto: true } },
        },
      });
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.CREATE,
      entidade: "MatriculaEsportiva",
      entidadeId: matricula.id,
      metadados: { turmaId, status: matricula.status },
    });

    return matricula;
  }

  async detalhe(user: AuthenticatedUser, id: string) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.ESPORTIVO);
    const turma = await this.prisma.turmaEsportiva.findUnique({
      where: { id },
      include: turmaEsportivaDetalheInclude,
    });
    if (!turma) throw new NotFoundException("Turma não encontrada");
    // Tenant: dados de atletas só para a unidade da turma (SUPER_ADMIN passa).
    if (
      !user.perfis.includes(Perfil.SUPER_ADMIN) &&
      turma.unidadeId !== profissional.unidadeId
    ) {
      throw new ForbiddenException("Esta turma pertence a outra unidade.");
    }

    // Detalhe expõe nomes e graduações dos atletas — leitura entra na trilha LGPD.
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "TurmaEsportiva",
      entidadeId: id,
      metadados: { contexto: "detalhe", matriculas: turma.matriculas.length },
    });

    return turma;
  }

  /** Encerra a turma: ativas viram CONCLUÍDA, espera nunca atendida vira CANCELADA. */
  async encerrar(user: AuthenticatedUser, id: string) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.ESPORTIVO);
    const previa = await this.prisma.turmaEsportiva.findUnique({
      where: { id },
      select: { id: true, profissionalId: true, status: true },
    });
    if (!previa) throw new NotFoundException("Turma não encontrada");
    this.profissionais.assertOwnership(previa.profissionalId, profissional, user);
    if (previa.status === StatusTurma.ENCERRADA) {
      throw new ConflictException("Turma já encerrada.");
    }

    // Lock na turma: dois encerramentos simultâneos não processam duas vezes.
    const resultado = await this.prisma.$transaction(async (tx) => {
      const [lockada] = await tx.$queryRaw<{ status: string }[]>`
        SELECT status FROM turmas_esportivas WHERE id = ${id} FOR UPDATE
      `;
      if (!lockada) throw new NotFoundException("Turma não encontrada");
      if (lockada.status === StatusTurma.ENCERRADA) {
        throw new ConflictException("Turma já encerrada.");
      }

      // Lista de espera nunca atendida morre no encerramento (não é evasão —
      // o atleta nunca treinou; sem isso o KPI de espera ficava inflado p/ sempre).
      const { count: esperaCanceladas } = await tx.matriculaEsportiva.updateMany({
        where: { turmaId: id, status: StatusMatricula.LISTA_ESPERA },
        data: { status: StatusMatricula.CANCELADA },
      });
      const { count: concluidas } = await tx.matriculaEsportiva.updateMany({
        where: { turmaId: id, status: StatusMatricula.ATIVA },
        data: { status: StatusMatricula.CONCLUIDA },
      });
      await tx.turmaEsportiva.update({
        where: { id },
        data: { status: StatusTurma.ENCERRADA, fimEm: new Date() },
      });

      return { concluidas, esperaCanceladas };
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.UPDATE,
      entidade: "TurmaEsportiva",
      entidadeId: id,
      metadados: { acao: "encerramento", ...resultado },
    });

    return resultado;
  }
}
