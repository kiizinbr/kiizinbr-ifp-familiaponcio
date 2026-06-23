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
  StatusInscricaoModelo,
  StatusMatricula,
  StatusSessaoPratica,
  TipoUnidade,
} from "@ifp/database";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/current-user.decorator";
import type { CriarModeloVoluntarioDto } from "./dto/criar-modelo-voluntario.dto";
import type { CriarSessaoPraticaDto } from "./dto/criar-sessao-pratica.dto";
import { ProfissionaisService } from "../medico/profissionais.service";

const sessaoInclude = {
  turma: { select: { id: true, codigo: true, curso: { select: { nome: true } } } },
  inscricoes: {
    orderBy: { criadoEm: "asc" as const },
    include: {
      modelo: { select: { id: true, nomeCompleto: true } },
      matricula: {
        select: {
          id: true,
          ficha: { select: { nomeCompleto: true } },
          membro: { select: { nomeCompleto: true } },
        },
      },
    },
  },
} satisfies Prisma.SessaoPraticaInclude;

/**
 * Banco de Modelos da Capacitação (C4): voluntários da comunidade que servem
 * de modelo em sessões práticas (ex.: cortes supervisionados) e o matching
 * aluno <-> modelo. Reusa ProfissionaisService p/ resolver a unidade do
 * instrutor logado (parede de tenant) e assertOwnership (dono da turma/sessão).
 */
@Injectable()
export class BancoModelosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly profissionais: ProfissionaisService,
  ) {}

  // ----------------------------------------------------------
  // Modelos voluntários (cadastro da comunidade)
  // ----------------------------------------------------------

  /** Lista os modelos voluntários ativos da unidade. Telefone é PII → LGPD. */
  async listarModelos(user: AuthenticatedUser, incluirInativos = false) {
    const prof = await this.profissionais.resolverPorUser(user, TipoUnidade.CAPACITACAO);
    const items = await this.prisma.modeloVoluntario.findMany({
      where: {
        unidadeId: prof.unidadeId,
        ...(incluirInativos ? {} : { ativo: true }),
      },
      orderBy: { nomeCompleto: "asc" },
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "ModeloVoluntario",
      metadados: { contexto: "listagem", total: items.length },
    });

    return { items, total: items.length };
  }

  /** Cadastra um modelo voluntário na unidade do instrutor logado. */
  async criarModelo(user: AuthenticatedUser, dto: CriarModeloVoluntarioDto) {
    const prof = await this.profissionais.resolverPorUser(user, TipoUnidade.CAPACITACAO);
    const modelo = await this.prisma.modeloVoluntario.create({
      data: {
        unidadeId: prof.unidadeId,
        nomeCompleto: dto.nomeCompleto.trim(),
        telefone: dto.telefone?.trim() || null,
        observacao: dto.observacao?.trim() || null,
        criadoPor: user.id,
      },
    });

    // Cadastro grava nome + telefone (PII) → trilha LGPD (sem logar o telefone).
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.CREATE,
      entidade: "ModeloVoluntario",
      entidadeId: modelo.id,
      metadados: { temTelefone: Boolean(modelo.telefone) },
    });

    return modelo;
  }

  // ----------------------------------------------------------
  // Sessões práticas (agenda por turma)
  // ----------------------------------------------------------

  /** Sessões práticas da unidade, opcionalmente filtradas por turma/status. */
  async listarSessoes(
    user: AuthenticatedUser,
    filtros: { turmaId?: string; status?: string } = {},
  ) {
    const prof = await this.profissionais.resolverPorUser(user, TipoUnidade.CAPACITACAO);

    const statusValido =
      filtros.status &&
      (Object.values(StatusSessaoPratica) as string[]).includes(filtros.status)
        ? (filtros.status as StatusSessaoPratica)
        : undefined;

    const sessoes = await this.prisma.sessaoPratica.findMany({
      where: {
        unidadeId: prof.unidadeId,
        ...(filtros.turmaId ? { turmaId: filtros.turmaId } : {}),
        ...(statusValido ? { status: statusValido } : {}),
      },
      orderBy: { data: "desc" },
      include: sessaoInclude,
    });

    // Detalhe das sessões expõe nomes de modelos e alunos → trilha LGPD.
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "SessaoPratica",
      metadados: { contexto: "listagem", total: sessoes.length },
    });

    const items = sessoes.map((s) => this.formatarSessao(s));
    return { items, total: items.length };
  }

  /** Detalhe de uma sessão (com inscrições e matching). */
  async detalheSessao(user: AuthenticatedUser, sessaoId: string) {
    const prof = await this.profissionais.resolverPorUser(user, TipoUnidade.CAPACITACAO);
    const sessao = await this.prisma.sessaoPratica.findUnique({
      where: { id: sessaoId },
      include: sessaoInclude,
    });
    if (!sessao) throw new NotFoundException("Sessão prática não encontrada.");
    this.assertMesmaUnidade(sessao.unidadeId, prof.unidadeId, user);

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "SessaoPratica",
      entidadeId: sessao.id,
      metadados: { contexto: "detalhe", inscricoes: sessao.inscricoes.length },
    });

    return this.formatarSessao(sessao);
  }

  /** Cria uma sessão prática para uma turma da unidade (instrutor = dono). */
  async criarSessao(user: AuthenticatedUser, dto: CriarSessaoPraticaDto) {
    const prof = await this.profissionais.resolverPorUser(user, TipoUnidade.CAPACITACAO);
    const turma = await this.prisma.turma.findUnique({
      where: { id: dto.turmaId },
      select: { id: true, unidadeId: true, profissionalId: true },
    });
    if (!turma) throw new NotFoundException("Turma não encontrada.");
    this.assertMesmaUnidade(turma.unidadeId, prof.unidadeId, user);
    // Só o instrutor responsável (ou super admin) cria sessões da sua turma.
    this.profissionais.assertOwnership(turma.profissionalId, prof, user);

    const sessao = await this.prisma.sessaoPratica.create({
      data: {
        unidadeId: turma.unidadeId,
        turmaId: turma.id,
        profissionalId: prof.id,
        titulo: dto.titulo.trim(),
        data: new Date(dto.data),
        vagasModelos: dto.vagasModelos ?? 1,
        observacao: dto.observacao?.trim() || null,
        status: StatusSessaoPratica.AGENDADA,
      },
      include: sessaoInclude,
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.CREATE,
      entidade: "SessaoPratica",
      entidadeId: sessao.id,
      metadados: { turmaId: turma.id, vagasModelos: sessao.vagasModelos },
    });

    return this.formatarSessao(sessao);
  }

  // ----------------------------------------------------------
  // Matching: inscrever modelo + vincular aluno
  // ----------------------------------------------------------

  /** Inscreve um modelo voluntário numa sessão (respeita as vagas). */
  async inscreverModelo(
    user: AuthenticatedUser,
    sessaoId: string,
    dto: { modeloId: string; matriculaId?: string },
  ) {
    const prof = await this.profissionais.resolverPorUser(user, TipoUnidade.CAPACITACAO);

    const sessao = await this.prisma.sessaoPratica.findUnique({
      where: { id: sessaoId },
      select: { id: true, unidadeId: true, profissionalId: true, status: true, vagasModelos: true },
    });
    if (!sessao) throw new NotFoundException("Sessão prática não encontrada.");
    this.assertMesmaUnidade(sessao.unidadeId, prof.unidadeId, user);
    this.profissionais.assertOwnership(sessao.profissionalId, prof, user);
    if (sessao.status !== StatusSessaoPratica.AGENDADA) {
      throw new BadRequestException("Só dá para inscrever modelos em sessão AGENDADA.");
    }

    const modelo = await this.prisma.modeloVoluntario.findUnique({
      where: { id: dto.modeloId },
      select: { id: true, unidadeId: true, ativo: true },
    });
    if (!modelo) throw new NotFoundException("Modelo voluntário não encontrado.");
    this.assertMesmaUnidade(modelo.unidadeId, prof.unidadeId, user);
    if (!modelo.ativo) {
      throw new BadRequestException("Este modelo voluntário está inativo.");
    }

    // matriculaId opcional já no ato da inscrição (matching antecipado).
    if (dto.matriculaId) {
      await this.assertMatriculaDaUnidade(dto.matriculaId, prof.unidadeId);
    }

    // Lock da sessão serializa inscrições concorrentes (mata overbooking e
    // a inscrição dupla do mesmo modelo, que o unique composto também cobre).
    const inscricao = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM sessoes_praticas WHERE id = ${sessaoId} FOR UPDATE`;

      const jaInscrito = await tx.inscricaoModelo.findFirst({
        where: { sessaoId, modeloId: dto.modeloId },
        select: { id: true },
      });
      if (jaInscrito) {
        throw new ConflictException("Este modelo já está inscrito nesta sessão.");
      }

      const inscritos = await tx.inscricaoModelo.count({
        where: { sessaoId, status: { not: StatusInscricaoModelo.CANCELADO } },
      });
      if (inscritos >= sessao.vagasModelos) {
        throw new BadRequestException("A sessão já atingiu o número de vagas de modelos.");
      }

      return tx.inscricaoModelo.create({
        data: {
          sessaoId,
          modeloId: dto.modeloId,
          matriculaId: dto.matriculaId ?? null,
          status: dto.matriculaId
            ? StatusInscricaoModelo.VINCULADO
            : StatusInscricaoModelo.INSCRITO,
          criadoPor: user.id,
        },
        include: {
          modelo: { select: { id: true, nomeCompleto: true } },
          matricula: {
            select: {
              id: true,
              ficha: { select: { nomeCompleto: true } },
              membro: { select: { nomeCompleto: true } },
            },
          },
        },
      });
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.CREATE,
      entidade: "InscricaoModelo",
      entidadeId: inscricao.id,
      metadados: { sessaoId, vinculado: Boolean(dto.matriculaId) },
    });

    return this.formatarInscricao(inscricao);
  }

  /** Vincula (ou troca) o aluno designado de uma inscrição existente. */
  async vincularAluno(
    user: AuthenticatedUser,
    inscricaoId: string,
    matriculaId: string,
  ) {
    const prof = await this.profissionais.resolverPorUser(user, TipoUnidade.CAPACITACAO);

    const inscricao = await this.prisma.inscricaoModelo.findUnique({
      where: { id: inscricaoId },
      include: { sessao: { select: { unidadeId: true, profissionalId: true, status: true } } },
    });
    if (!inscricao) throw new NotFoundException("Inscrição não encontrada.");
    this.assertMesmaUnidade(inscricao.sessao.unidadeId, prof.unidadeId, user);
    this.profissionais.assertOwnership(inscricao.sessao.profissionalId, prof, user);
    if (inscricao.status === StatusInscricaoModelo.CANCELADO) {
      throw new BadRequestException("Esta inscrição está cancelada.");
    }

    await this.assertMatriculaDaUnidade(matriculaId, prof.unidadeId);

    const atualizada = await this.prisma.inscricaoModelo.update({
      where: { id: inscricaoId },
      data: { matriculaId, status: StatusInscricaoModelo.VINCULADO },
      include: {
        modelo: { select: { id: true, nomeCompleto: true } },
        matricula: {
          select: {
            id: true,
            ficha: { select: { nomeCompleto: true } },
            membro: { select: { nomeCompleto: true } },
          },
        },
      },
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.UPDATE,
      entidade: "InscricaoModelo",
      entidadeId: inscricaoId,
      metadados: { acao: "vinculo-aluno" },
    });

    return this.formatarInscricao(atualizada);
  }

  // ----------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------

  /** Tenant: registro tem de ser da unidade do instrutor (SUPER_ADMIN passa). */
  private assertMesmaUnidade(
    unidadeDoRegistro: string,
    unidadeDoUser: string,
    user: AuthenticatedUser,
  ): void {
    if (
      !user.perfis.includes(Perfil.SUPER_ADMIN) &&
      unidadeDoRegistro !== unidadeDoUser
    ) {
      throw new ForbiddenException("Este registro pertence a outra unidade.");
    }
  }

  /** Valida que a matrícula existe e é da mesma unidade (não vaza aluno alheio). */
  private async assertMatriculaDaUnidade(
    matriculaId: string,
    unidadeId: string,
  ): Promise<void> {
    const mat = await this.prisma.matricula.findUnique({
      where: { id: matriculaId },
      select: { id: true, unidadeId: true, status: true },
    });
    if (!mat || mat.unidadeId !== unidadeId) {
      throw new NotFoundException("Aluno (matrícula) não encontrado nesta unidade.");
    }
    if (mat.status !== StatusMatricula.ATIVA) {
      throw new BadRequestException("Só dá para vincular aluno com matrícula ATIVA.");
    }
  }

  private formatarSessao(s: Prisma.SessaoPraticaGetPayload<{ include: typeof sessaoInclude }>) {
    return {
      id: s.id,
      titulo: s.titulo,
      data: s.data,
      vagasModelos: s.vagasModelos,
      status: s.status,
      observacao: s.observacao,
      turma: { id: s.turma.id, codigo: s.turma.codigo, curso: s.turma.curso.nome },
      inscricoes: s.inscricoes.map((i) => this.formatarInscricao(i)),
      vagasOcupadas: s.inscricoes.filter(
        (i) => i.status !== StatusInscricaoModelo.CANCELADO,
      ).length,
    };
  }

  private formatarInscricao(i: {
    id: string;
    status: StatusInscricaoModelo;
    modelo: { id: string; nomeCompleto: string };
    matricula: {
      id: string;
      ficha: { nomeCompleto: string };
      membro: { nomeCompleto: string } | null;
    } | null;
  }) {
    return {
      id: i.id,
      status: i.status,
      modelo: { id: i.modelo.id, nome: i.modelo.nomeCompleto },
      aluno: i.matricula
        ? {
            matriculaId: i.matricula.id,
            nome: i.matricula.membro?.nomeCompleto ?? i.matricula.ficha.nomeCompleto,
          }
        : null,
    };
  }
}
