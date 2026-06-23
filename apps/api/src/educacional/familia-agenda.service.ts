import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AcaoAuditoria, StatusEvento } from "@ifp/database";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/current-user.decorator";
import { diaHojeSP, janelaDoDiaSP } from "./dia-util";
import type { ResponderEventoDto } from "./dto/responder-evento.dto";
import type { ResponderPresencaDto } from "./dto/responder-presenca.dto";

/**
 * Portal da família — agenda de eventos (calendário + RSVP) e o "vem amanhã?"
 * da creche. Ownership SEMPRE por `User.fichaCidadaId` (mesmo molde do
 * FamiliaService): nenhum endpoint aceita fichaId do client, e cada criança/
 * evento é conferido contra a própria família antes de ler ou gravar (IDOR).
 */
@Injectable()
export class FamiliaAgendaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** O login do responsável → a ficha da família. Sem vínculo, 403. */
  private async resolverFichaId(user: AuthenticatedUser): Promise<string> {
    const registro = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { fichaCidadaId: true },
    });
    if (!registro?.fichaCidadaId) {
      throw new ForbiddenException(
        "Seu usuário não está vinculado a uma ficha de família — procure a secretaria.",
      );
    }
    return registro.fichaCidadaId;
  }

  /** A criança é da família do usuário logado? Senão, 403. */
  private async assertCriancaDaFamilia(fichaId: string, membroId: string) {
    const crianca = await this.prisma.membroFamiliar.findFirst({
      where: { id: membroId, fichaId },
      select: { id: true, nomeCompleto: true },
    });
    if (!crianca) {
      throw new ForbiddenException("Esta criança não pertence à sua família.");
    }
    return crianca;
  }

  /**
   * Unidades + turmas onde a família tem criança matriculada (ativa). Define
   * o escopo dos eventos visíveis: a família só vê o calendário das unidades
   * das suas crianças (e só eventos gerais ou da turma da própria criança).
   */
  private async escopoMatriculas(fichaId: string) {
    const matriculas = await this.prisma.matriculaInfantil.findMany({
      where: { fichaId, ativa: true },
      select: { unidadeId: true, turmaId: true, membroId: true },
    });
    return {
      unidadeIds: [...new Set(matriculas.map((m) => m.unidadeId))],
      turmaIds: [...new Set(matriculas.map((m) => m.turmaId))],
      membroIds: [...new Set(matriculas.map((m) => m.membroId))],
    };
  }

  /**
   * Calendário de eventos das unidades das minhas crianças (futuros + recentes).
   * Para cada evento que pede confirmação, devolve a resposta já dada por cada
   * criança da família — pra UI mostrar "confirmado/pendente".
   */
  async agenda(user: AuthenticatedUser) {
    const fichaId = await this.resolverFichaId(user);
    const { unidadeIds, turmaIds, membroIds } = await this.escopoMatriculas(fichaId);

    if (unidadeIds.length === 0) {
      return { items: [] };
    }

    // Janela: do começo de hoje (SP) em diante — passado fica fora do portal.
    const { dataDb: inicioHoje } = janelaDoDiaSP();

    const eventos = await this.prisma.eventoUnidade.findMany({
      where: {
        unidadeId: { in: unidadeIds },
        status: StatusEvento.AGENDADO,
        inicioEm: { gte: inicioHoje },
        // evento geral da unidade OU restrito a uma turma da própria criança
        OR: [{ turmaId: null }, { turmaId: { in: turmaIds } }],
      },
      orderBy: { inicioEm: "asc" },
      take: 100,
      include: {
        unidade: { select: { id: true, nome: true } },
        turma: { select: { id: true, nome: true } },
        confirmacoes: {
          where: { fichaId },
          select: { membroId: true, resposta: true, observacao: true, respondidoEm: true },
        },
      },
    });

    return {
      items: eventos.map((ev) => ({
        id: ev.id,
        titulo: ev.titulo,
        descricao: ev.descricao,
        local: ev.local,
        inicioEm: ev.inicioEm,
        fimEm: ev.fimEm,
        pedeConfirmacao: ev.pedeConfirmacao,
        unidade: ev.unidade,
        turma: ev.turma,
        // RSVP da família: uma entrada por criança que já respondeu.
        confirmacoes: ev.confirmacoes,
        // Quantas crianças da família ainda não responderam (só se pede RSVP).
        pendentes: ev.pedeConfirmacao
          ? membroIds.filter((mid) => !ev.confirmacoes.some((c) => c.membroId === mid)).length
          : 0,
      })),
    };
  }

  /**
   * RSVP a um evento — por criança da própria família. Idempotente (upsert):
   * re-confirmar atualiza a resposta. Confere que o evento é de uma unidade
   * onde a criança está matriculada (IDOR de gravação) e que pede confirmação.
   */
  async responderEvento(user: AuthenticatedUser, eventoId: string, dto: ResponderEventoDto) {
    const fichaId = await this.resolverFichaId(user);
    await this.assertCriancaDaFamilia(fichaId, dto.membroId);

    const evento = await this.prisma.eventoUnidade.findUnique({
      where: { id: eventoId },
      select: { id: true, unidadeId: true, turmaId: true, pedeConfirmacao: true, status: true },
    });
    if (!evento || evento.status !== StatusEvento.AGENDADO) {
      throw new NotFoundException("Evento não encontrado.");
    }
    if (!evento.pedeConfirmacao) {
      throw new ForbiddenException("Este evento não pede confirmação de presença.");
    }

    // A criança precisa estar matriculada na MESMA unidade do evento (e, se o
    // evento é de turma, na MESMA turma). Senão, não é "dela" → 404 (IDOR).
    const matricula = await this.prisma.matriculaInfantil.findFirst({
      where: {
        fichaId,
        membroId: dto.membroId,
        ativa: true,
        unidadeId: evento.unidadeId,
        ...(evento.turmaId ? { turmaId: evento.turmaId } : {}),
      },
      select: { id: true },
    });
    if (!matricula) {
      throw new NotFoundException("Evento não encontrado.");
    }

    const confirmacao = await this.prisma.confirmacaoEvento.upsert({
      where: { eventoId_membroId: { eventoId, membroId: dto.membroId } },
      update: { resposta: dto.resposta, observacao: dto.observacao ?? null },
      create: {
        eventoId,
        fichaId,
        membroId: dto.membroId,
        resposta: dto.resposta,
        observacao: dto.observacao ?? null,
      },
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.UPDATE,
      entidade: "ConfirmacaoEvento",
      entidadeId: confirmacao.id,
      metadados: {
        contexto: "familia.responderEvento",
        eventoId,
        membroId: dto.membroId,
        resposta: dto.resposta,
      },
    });

    return confirmacao;
  }

  /**
   * "Vem amanhã?" da creche — lista a confirmação de cada criança da família
   * para um dia (default: amanhã no fuso de SP). Devolve também as crianças
   * sem resposta, pra UI pedir o SIM/NAO.
   */
  async presencaDoDia(user: AuthenticatedUser, data?: string) {
    const fichaId = await this.resolverFichaId(user);
    const { dataDb, dia } = this.resolverDia(data);

    const matriculas = await this.prisma.matriculaInfantil.findMany({
      where: { fichaId, ativa: true },
      select: {
        crianca: { select: { id: true, nomeCompleto: true } },
        turma: { select: { id: true, nome: true } },
        unidade: { select: { id: true, nome: true } },
      },
    });
    const membroIds = matriculas.map((m) => m.crianca.id);

    const confirmacoes = membroIds.length
      ? await this.prisma.presencaCreche.findMany({
          where: { fichaId, data: dataDb, membroId: { in: membroIds } },
          select: { membroId: true, resposta: true, observacao: true, respondidaEm: true },
        })
      : [];

    return {
      dia,
      items: matriculas.map((m) => {
        const conf = confirmacoes.find((c) => c.membroId === m.crianca.id);
        return {
          crianca: m.crianca,
          turma: m.turma,
          unidade: m.unidade,
          resposta: conf?.resposta ?? null,
          observacao: conf?.observacao ?? null,
          respondidaEm: conf?.respondidaEm ?? null,
        };
      }),
    };
  }

  /** Grava o "vem amanhã?" de uma criança da própria família (idempotente). */
  async responderPresenca(user: AuthenticatedUser, dto: ResponderPresencaDto) {
    const fichaId = await this.resolverFichaId(user);
    await this.assertCriancaDaFamilia(fichaId, dto.membroId);

    // Só faz sentido se a criança tem matrícula infantil ATIVA (é da creche).
    const matricula = await this.prisma.matriculaInfantil.findFirst({
      where: { fichaId, membroId: dto.membroId, ativa: true },
      select: { id: true },
    });
    if (!matricula) {
      throw new NotFoundException("Esta criança não tem matrícula ativa na creche.");
    }

    const { dataDb, dia } = this.resolverDia(dto.data);

    const presenca = await this.prisma.presencaCreche.upsert({
      where: { membroId_data: { membroId: dto.membroId, data: dataDb } },
      update: { resposta: dto.resposta, observacao: dto.observacao ?? null },
      create: {
        fichaId,
        membroId: dto.membroId,
        data: dataDb,
        resposta: dto.resposta,
        observacao: dto.observacao ?? null,
      },
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.UPDATE,
      entidade: "PresencaCreche",
      entidadeId: presenca.id,
      metadados: {
        contexto: "familia.responderPresenca",
        membroId: dto.membroId,
        dia,
        resposta: dto.resposta,
      },
    });

    return presenca;
  }

  /**
   * Resolve o dia civil (SP) da confirmação: sem `data`, o default do
   * "vem amanhã?" é o DIA SEGUINTE; com `data`, valida e usa o dia informado.
   */
  private resolverDia(data?: string) {
    if (data) {
      const { dataDb, dia } = janelaDoDiaSP(data);
      return { dataDb, dia };
    }
    const hoje = diaHojeSP();
    const amanha = new Date(`${hoje}T00:00:00.000Z`);
    amanha.setUTCDate(amanha.getUTCDate() + 1);
    const dia = amanha.toISOString().slice(0, 10);
    return { dataDb: amanha, dia };
  }
}
