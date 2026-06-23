import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  AcaoAuditoria,
  Prisma,
  SentidoCheck,
  StatusDiario,
  TipoUnidade,
} from "@ifp/database";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/current-user.decorator";
import { ProfissionaisService } from "../medico/profissionais.service";
import { CriancasService } from "./criancas.service";
import type { CriarRegistroRotinaDto } from "./dto/criar-registro-rotina.dto";
import type { CriarRotinaLoteDto } from "./dto/criar-rotina-lote.dto";
import type { RegistrarCheckDto } from "./dto/registrar-check.dto";
import { janelaDoDiaSP } from "./dia-util";

const MSG_DIARIO_FECHADO = "Diário fechado — registros são imutáveis após o selo.";

@Injectable()
export class RotinaService {
  private readonly logger = new Logger(RotinaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly profissionais: ProfissionaisService,
    private readonly criancas: CriancasService,
  ) {}

  /**
   * REGRA CENTRAL da vertical (segurança física): só entrega/retira quem está
   * autorizado, não revogado, dentro da vigência e SEM restrição judicial.
   * Tentativa bloqueada vira auditoria + log estruturado — em disputa de
   * guarda, a tentativa é tão importante quanto o evento.
   */
  private async validarAutorizado(
    user: AuthenticatedUser,
    membroId: string,
    autorizadoId: string,
    sentido: SentidoCheck,
  ) {
    const autorizado = await this.prisma.responsavelAutorizado.findFirst({
      where: { id: autorizadoId, membroId },
    });

    const bloquear = (motivo: string) => {
      this.audit.registrar({
        userId: user.id,
        acao: AcaoAuditoria.UPDATE,
        entidade: "CheckInOut.tentativaBloqueada",
        entidadeId: autorizadoId,
        metadados: { membroId, sentido, motivo },
      });
      this.logger.warn(
        `Check ${sentido} BLOQUEADO — membro=${membroId} autorizado=${autorizadoId} motivo=${motivo}`,
      );
      return new ForbiddenException(`Retirada/entrega bloqueada: ${motivo}.`);
    };

    if (!autorizado) {
      throw bloquear("pessoa não está na lista de autorizados desta criança");
    }
    if (autorizado.restricaoJudicial) {
      throw bloquear("restrição judicial vigente — comunique a coordenação");
    }
    if (autorizado.revogadoEm) {
      throw bloquear("autorização revogada pelo responsável legal");
    }
    if (autorizado.vigenteAte && autorizado.vigenteAte < new Date()) {
      throw bloquear("autorização vencida");
    }
    return autorizado;
  }

  private async ultimoCheckDoDia(
    tx: Prisma.TransactionClient,
    membroId: string,
  ) {
    const { inicio, fim } = janelaDoDiaSP();
    return tx.checkInOut.findFirst({
      where: { membroId, ocorridoEm: { gte: inicio, lt: fim } },
      orderBy: { ocorridoEm: "desc" },
    });
  }

  /** Check-in da manhã: registra QUEM entregou a criança. */
  async checkin(user: AuthenticatedUser, dto: RegistrarCheckDto) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.EDUCACIONAL);
    await this.criancas.assertCriancaDaUnidade(dto.membroId, profissional.unidadeId);
    const autorizado = await this.validarAutorizado(
      user,
      dto.membroId,
      dto.autorizadoId,
      SentidoCheck.ENTRADA,
    );

    // Lock da linha do membro: serializa o ler-último-check + criar com outro
    // clique simultâneo — sem janela pra gravar dois ENTRADA seguidos (mesma
    // disciplina de $transaction + FOR UPDATE de registrarRotina/fecharDiario).
    const check = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM membros_familiares WHERE id = ${dto.membroId} FOR UPDATE
      `;

      const ultimo = await this.ultimoCheckDoDia(tx, dto.membroId);
      if (ultimo?.sentido === SentidoCheck.ENTRADA) {
        throw new ConflictException("Esta criança já está presente (check-in sem saída).");
      }

      return tx.checkInOut.create({
        data: {
          unidadeId: profissional.unidadeId,
          membroId: dto.membroId,
          sentido: SentidoCheck.ENTRADA,
          autorizadoId: autorizado.id,
          profissionalId: profissional.id,
        },
        include: { autorizado: { select: { nome: true, parentesco: true } } },
      });
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.CREATE,
      entidade: "CheckInOut",
      entidadeId: check.id,
      metadados: { membroId: dto.membroId, sentido: "ENTRADA", autorizadoId: autorizado.id },
    });

    return check;
  }

  /** Check-out: valida pessoa autorizada e exige check-in aberto no dia. */
  async checkout(user: AuthenticatedUser, dto: RegistrarCheckDto) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.EDUCACIONAL);
    await this.criancas.assertCriancaDaUnidade(dto.membroId, profissional.unidadeId);
    const autorizado = await this.validarAutorizado(
      user,
      dto.membroId,
      dto.autorizadoId,
      SentidoCheck.SAIDA,
    );

    // Lock da linha do membro: serializa o ler-último-check + criar com outro
    // clique simultâneo — sem janela pra gravar dois SAIDA seguidos (mesma
    // disciplina de $transaction + FOR UPDATE de registrarRotina/fecharDiario).
    const check = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM membros_familiares WHERE id = ${dto.membroId} FOR UPDATE
      `;

      const ultimo = await this.ultimoCheckDoDia(tx, dto.membroId);
      if (!ultimo || ultimo.sentido === SentidoCheck.SAIDA) {
        throw new ConflictException(
          "Não há check-in aberto hoje para esta criança — check-out bloqueado.",
        );
      }

      return tx.checkInOut.create({
        data: {
          unidadeId: profissional.unidadeId,
          membroId: dto.membroId,
          sentido: SentidoCheck.SAIDA,
          autorizadoId: autorizado.id,
          profissionalId: profissional.id,
        },
        include: { autorizado: { select: { nome: true, parentesco: true } } },
      });
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.CREATE,
      entidade: "CheckInOut",
      entidadeId: check.id,
      metadados: { membroId: dto.membroId, sentido: "SAIDA", autorizadoId: autorizado.id },
    });

    return check;
  }

  /**
   * Lançamento de rotina (meta 5–10s): cria o diário do dia se não existir;
   * diário FECHADO é imutável (409).
   */
  async registrarRotina(
    user: AuthenticatedUser,
    membroId: string,
    dto: CriarRegistroRotinaDto,
  ) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.EDUCACIONAL);
    await this.criancas.assertCriancaDaUnidade(membroId, profissional.unidadeId);
    const { dataDb } = janelaDoDiaSP();

    const registro = await this.prisma.$transaction(async (tx) => {
      const diario = await tx.diarioDia.upsert({
        where: { membroId_data: { membroId, data: dataDb } },
        update: {},
        create: { unidadeId: profissional.unidadeId, membroId, data: dataDb },
      });

      // Lock do diário: serializa com o fechar() — sem janela pra registrar
      // depois do selo (mesma disciplina do prontuário médico).
      const [lockado] = await tx.$queryRaw<{ status: StatusDiario }[]>`
        SELECT status FROM diarios_dia WHERE id = ${diario.id} FOR UPDATE
      `;
      if (!lockado) throw new NotFoundException("Diário não encontrado");
      if (lockado.status === StatusDiario.FECHADO) {
        throw new ConflictException(MSG_DIARIO_FECHADO);
      }

      return tx.registroRotina.create({
        data: {
          diarioId: diario.id,
          tipo: dto.tipo,
          descricao: dto.descricao,
          profissionalId: profissional.id,
        },
      });
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.CREATE,
      entidade: "RegistroRotina",
      entidadeId: registro.id,
      metadados: { membroId, tipo: dto.tipo },
    });

    return registro;
  }

  /**
   * Lançamento em LOTE: aplica UM registro do mesmo tipo/descrição a todas as
   * crianças (ou às escolhidas) da turma de uma vez — "almoço servido", "soneca".
   * Reusa o model de diário (não inventa nada): para cada criança faz o mesmo
   * upsert-do-dia + lock + create de registrarRotina. Diário FECHADO é PULADO
   * (imutável após o selo), não derruba o lote — relatamos o que foi pulado.
   */
  async registrarRotinaLote(
    user: AuthenticatedUser,
    turmaId: string,
    dto: CriarRotinaLoteDto,
  ) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.EDUCACIONAL);

    // Tenant: a turma tem de ser desta unidade (anti-enumeração: 404 cross-unidade).
    const turma = await this.prisma.turmaInfantil.findUnique({
      where: { id: turmaId },
      select: { id: true, unidadeId: true },
    });
    if (!turma || turma.unidadeId !== profissional.unidadeId) {
      throw new NotFoundException("Turma não encontrada");
    }

    const matriculas = await this.prisma.matriculaInfantil.findMany({
      where: { turmaId, ativa: true },
      select: { membroId: true },
    });
    let alvos = matriculas.map((m) => m.membroId);

    // Filtro opcional por criança — só vale para quem está matriculado na turma.
    if (dto.membroIds && dto.membroIds.length > 0) {
      const selecionados = new Set(dto.membroIds);
      const naTurma = new Set(alvos);
      const forasDaTurma = dto.membroIds.filter((id) => !naTurma.has(id));
      if (forasDaTurma.length > 0) {
        throw new BadRequestException(
          "Há crianças que não estão matriculadas nesta turma.",
        );
      }
      alvos = alvos.filter((id) => selecionados.has(id));
    }

    if (alvos.length === 0) {
      throw new BadRequestException("Não há crianças para lançar a rotina nesta turma.");
    }

    const { dataDb } = janelaDoDiaSP();
    const aplicados: { membroId: string; registroId: string }[] = [];
    const pulados: { membroId: string; motivo: string }[] = [];

    // Mesma disciplina do lançamento individual: upsert do diário + lock FOR
    // UPDATE + create, por criança. Uma criança com diário selado é pulada
    // (409 vira "pulado"), preservando a imutabilidade sem abortar o lote.
    for (const membroId of alvos) {
      try {
        const registro = await this.prisma.$transaction(async (tx) => {
          const diario = await tx.diarioDia.upsert({
            where: { membroId_data: { membroId, data: dataDb } },
            update: {},
            create: { unidadeId: profissional.unidadeId, membroId, data: dataDb },
          });

          const [lockado] = await tx.$queryRaw<{ status: StatusDiario }[]>`
            SELECT status FROM diarios_dia WHERE id = ${diario.id} FOR UPDATE
          `;
          if (!lockado) throw new NotFoundException("Diário não encontrado");
          if (lockado.status === StatusDiario.FECHADO) {
            throw new ConflictException(MSG_DIARIO_FECHADO);
          }

          return tx.registroRotina.create({
            data: {
              diarioId: diario.id,
              tipo: dto.tipo,
              descricao: dto.descricao,
              profissionalId: profissional.id,
            },
          });
        });
        aplicados.push({ membroId, registroId: registro.id });
      } catch (e) {
        if (e instanceof ConflictException) {
          pulados.push({ membroId, motivo: "diário já fechado" });
          continue;
        }
        throw e;
      }
    }

    // O lote é escrita de dossiê de menores — uma linha de trilha cobre o ato.
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.CREATE,
      entidade: "RegistroRotina.lote",
      entidadeId: turmaId,
      metadados: {
        turmaId,
        tipo: dto.tipo,
        aplicados: aplicados.length,
        pulados: pulados.length,
      },
    });

    return {
      tipo: dto.tipo,
      descricao: dto.descricao,
      totalAlvos: alvos.length,
      aplicados,
      pulados,
    };
  }

  /** Diário do dia da criança (visão do educador). */
  async diarioDoDia(user: AuthenticatedUser, membroId: string, data?: string) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.EDUCACIONAL);
    await this.criancas.assertCriancaDaUnidade(membroId, profissional.unidadeId);
    const { dataDb, dia } = janelaDoDiaSP(data);

    const diario = await this.prisma.diarioDia.findUnique({
      where: { membroId_data: { membroId, data: dataDb } },
      include: {
        registros: { orderBy: { ocorridoEm: "asc" } },
        fechadoPor: { include: { user: { select: { nome: true } } } },
      },
    });

    // Dossiê do menor (rotina do dia) é dado sensível — leitura entra na trilha LGPD.
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "DiarioDia",
      entidadeId: diario?.id ?? membroId,
      metadados: { contexto: "educacional.diarioDoDia", membroId, dia },
    });
    return { dia, diario };
  }

  /** Sela o diário — só então ele fica visível à família. */
  async fecharDiario(user: AuthenticatedUser, diarioId: string) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.EDUCACIONAL);
    const diario = await this.prisma.diarioDia.findUnique({
      where: { id: diarioId },
      include: { _count: { select: { registros: true } } },
    });
    if (!diario) throw new NotFoundException("Diário não encontrado");
    // Anti-enumeração: cross-unidade responde 404 (não 403) — não confirma o id.
    if (diario.unidadeId !== profissional.unidadeId) {
      throw new NotFoundException("Diário não encontrado");
    }
    if (diario.status === StatusDiario.FECHADO) {
      throw new ConflictException("Diário já fechado.");
    }
    if (diario._count.registros === 0) {
      throw new BadRequestException(
        "Lance ao menos um registro antes de fechar o diário do dia.",
      );
    }

    // updateMany condicional: dois selos simultâneos → o segundo recebe 409.
    const fechado = await this.prisma.$transaction(async (tx) => {
      const r = await tx.diarioDia.updateMany({
        where: { id: diarioId, status: StatusDiario.ABERTO },
        data: {
          status: StatusDiario.FECHADO,
          fechadoEm: new Date(),
          profissionalId: profissional.id,
        },
      });
      if (r.count === 0) throw new ConflictException("Diário já fechado.");
      return tx.diarioDia.findUniqueOrThrow({
        where: { id: diarioId },
        include: { registros: { orderBy: { ocorridoEm: "asc" } } },
      });
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.UPDATE,
      entidade: "DiarioDia",
      entidadeId: diarioId,
      metadados: { acao: "fechamento", membroId: diario.membroId },
    });

    return fechado;
  }
}
