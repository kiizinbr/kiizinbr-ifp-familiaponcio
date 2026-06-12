import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AcaoAuditoria, TipoUnidade } from "@ifp/database";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/current-user.decorator";
import { ProfissionaisService } from "../medico/profissionais.service";
import type { CriarConversaDto } from "./dto/criar-conversa.dto";
import type { CriarMensagemDto } from "./dto/criar-mensagem.dto";

const TAMANHO_MAXIMO_MENSAGEM = 2000;
/** Janela da lista/thread enquanto não há paginação por cursor (débito registrado). */
const LIMITE_LISTA_CONVERSAS = 100;
const LIMITE_MENSAGENS_THREAD = 200;
/** Prévia da última mensagem na lista (minimização LGPD: o corpo inteiro só na thread). */
const TAMANHO_PREVIA_LISTA = 200;

/** Select mínimo da conversa (LGPD: nunca devolve a ficha inteira). */
const SELECT_CONVERSA_BASICA = {
  id: true,
  criadoEm: true,
  crianca: { select: { id: true, nomeCompleto: true } },
} as const;

type ConversaBasica = {
  id: string;
  criadoEm: Date;
  crianca: { id: string; nomeCompleto: string };
};

/**
 * Mensagem 1:1 família↔instituto (estilo ClassApp): protege o número pessoal
 * da equipe e concentra tudo numa ÚNICA conversa por criança (membroId @unique).
 * Lado equipe entra pela parede de tenant (resolverPorUser EDUCACIONAL);
 * lado família entra pela ownership (fichaId do User) — nunca aceita fichaId do client.
 */
@Injectable()
export class ConversasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly profissionais: ProfissionaisService,
  ) {}

  // ───────────────────────── lado EQUIPE ─────────────────────────

  /** Get-or-create idempotente: criança elegível = matrícula infantil ATIVA na unidade. */
  async abrirConversaEquipe(user: AuthenticatedUser, dto: CriarConversaDto) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.EDUCACIONAL);

    const matricula = await this.prisma.matriculaInfantil.findFirst({
      where: { membroId: dto.membroId, unidadeId: profissional.unidadeId, ativa: true },
      select: { fichaId: true },
    });
    if (!matricula) {
      // Parede de tenant (LGPD): criança SEM vínculo com a minha unidade é
      // indistinguível de inexistente — 404 nos dois casos, sem vazar que o
      // membroId existe em outra unidade. 409 só para matrícula minha inativa.
      const matriculaNaMinhaUnidade = await this.prisma.matriculaInfantil.findFirst({
        where: { membroId: dto.membroId, unidadeId: profissional.unidadeId },
        select: { id: true },
      });
      if (!matriculaNaMinhaUnidade) throw new NotFoundException("Criança não encontrada.");
      throw new ConflictException(
        "Esta criança não possui matrícula infantil ativa na sua unidade.",
      );
    }

    const conversa = await this.prisma.conversaFamilia.upsert({
      where: { membroId: dto.membroId },
      update: {},
      create: {
        unidadeId: profissional.unidadeId,
        membroId: dto.membroId,
        fichaId: matricula.fichaId,
      },
      select: SELECT_CONVERSA_BASICA,
    });
    return this.formatarConversaBasica(conversa);
  }

  /** Lista da unidade: última mensagem + não lidas (mensagens da FAMÍLIA sem recibo). */
  async listarConversasEquipe(user: AuthenticatedUser) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.EDUCACIONAL);
    return this.listarConversas({ unidadeId: profissional.unidadeId }, false);
  }

  /** Thread completa; efeito: marca as mensagens da família como lidas (recibo). */
  async abrirThreadEquipe(user: AuthenticatedUser, conversaId: string) {
    const conversa = await this.assertConversaDaUnidade(user, conversaId);
    return this.abrirThread(user, conversa, false, "educacional.conversa");
  }

  async enviarMensagemEquipe(user: AuthenticatedUser, conversaId: string, dto: CriarMensagemDto) {
    const conversa = await this.assertConversaDaUnidade(user, conversaId);
    return this.enviarMensagem(user, conversa.id, true, dto);
  }

  // ──────────────────────── lado FAMÍLIA ─────────────────────────
  // fichaId chega SEMPRE resolvido pelo FamiliaService (User.fichaCidadaId).

  /** Get-or-create: a criança precisa ser da família; unidade vem da matrícula ativa. */
  async abrirConversaFamilia(fichaId: string, dto: CriarConversaDto) {
    const membro = await this.prisma.membroFamiliar.findUnique({
      where: { id: dto.membroId },
      select: { id: true, fichaId: true },
    });
    // Criança de outra ficha é indistinguível de inexistente (anti-enumeração,
    // dado de menor): 404 nos dois casos.
    if (!membro || membro.fichaId !== fichaId) {
      throw new NotFoundException("Criança não encontrada.");
    }

    const existente = await this.prisma.conversaFamilia.findUnique({
      where: { membroId: dto.membroId },
      select: SELECT_CONVERSA_BASICA,
    });
    if (existente) return this.formatarConversaBasica(existente);

    const matricula = await this.prisma.matriculaInfantil.findFirst({
      where: { membroId: dto.membroId, ativa: true },
      select: { unidadeId: true },
    });
    if (!matricula) {
      throw new ConflictException("Esta criança não possui matrícula infantil ativa.");
    }

    // Upsert (e não create): corrida benigna com o lado equipe abrindo a mesma thread.
    const conversa = await this.prisma.conversaFamilia.upsert({
      where: { membroId: dto.membroId },
      update: {},
      create: { unidadeId: matricula.unidadeId, membroId: dto.membroId, fichaId },
      select: SELECT_CONVERSA_BASICA,
    });
    return this.formatarConversaBasica(conversa);
  }

  /** Conversas das crianças da ficha: não lidas = mensagens da EQUIPE sem recibo. */
  async listarConversasFamilia(fichaId: string) {
    return this.listarConversas({ fichaId }, true);
  }

  /** Thread completa; efeito: marca as mensagens da equipe como lidas (recibo). */
  async abrirThreadFamilia(user: AuthenticatedUser, fichaId: string, conversaId: string) {
    const conversa = await this.assertConversaDaFamilia(fichaId, conversaId);
    return this.abrirThread(user, conversa, true, "familia.conversa");
  }

  async enviarMensagemFamilia(
    user: AuthenticatedUser,
    fichaId: string,
    conversaId: string,
    dto: CriarMensagemDto,
  ) {
    const conversa = await this.assertConversaDaFamilia(fichaId, conversaId);
    return this.enviarMensagem(user, conversa.id, false, dto);
  }

  // ──────────────────────── núcleo comum ─────────────────────────

  private async buscarConversa(conversaId: string) {
    const conversa = await this.prisma.conversaFamilia.findUnique({
      where: { id: conversaId },
      select: {
        id: true,
        unidadeId: true,
        fichaId: true,
        criadoEm: true,
        crianca: { select: { id: true, nomeCompleto: true } },
      },
    });
    if (!conversa) throw new NotFoundException("Conversa não encontrada.");
    return conversa;
  }

  /**
   * Tenant: conversa de outra unidade = 404, não 403 — thread sobre menor de outro
   * salão é indistinguível de inexistente (anti-enumeração de conversaId).
   */
  private async assertConversaDaUnidade(user: AuthenticatedUser, conversaId: string) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.EDUCACIONAL);
    const conversa = await this.buscarConversa(conversaId);
    if (conversa.unidadeId !== profissional.unidadeId) {
      throw new NotFoundException("Conversa não encontrada.");
    }
    return conversa;
  }

  /** Ownership: conversa de outra ficha = 404 (mesma razão anti-enumeração acima). */
  private async assertConversaDaFamilia(fichaId: string, conversaId: string) {
    const conversa = await this.buscarConversa(conversaId);
    if (conversa.fichaId !== fichaId) {
      throw new NotFoundException("Conversa não encontrada.");
    }
    return conversa;
  }

  /**
   * Lista no shape comum aos dois lados, ordenada por última atividade desc.
   * `naoLidasLadoEquipe=true` conta mensagens da equipe (visão da família);
   * `false` conta mensagens da família (visão da equipe).
   */
  private async listarConversas(
    where: { unidadeId: string } | { fichaId: string },
    naoLidasLadoEquipe: boolean,
  ) {
    // atualizadoEm é tocado a cada mensagem enviada → ordena por última atividade
    // direto no banco, o que torna o take seguro (janela = conversas mais recentes).
    const conversas = await this.prisma.conversaFamilia.findMany({
      where,
      orderBy: { atualizadoEm: "desc" },
      take: LIMITE_LISTA_CONVERSAS,
      select: {
        id: true,
        criadoEm: true,
        crianca: { select: { id: true, nomeCompleto: true } },
        mensagens: {
          orderBy: { criadoEm: "desc" },
          take: 1,
          select: { corpo: true, criadoEm: true, ladoEquipe: true },
        },
        _count: {
          select: {
            mensagens: { where: { ladoEquipe: naoLidasLadoEquipe, lidaEm: null } },
          },
        },
      },
    });

    const items = conversas.map((c) => ({
      id: c.id,
      crianca: { id: c.crianca.id, nome: c.crianca.nomeCompleto },
      ultimaMensagem: c.mensagens[0]
        ? { ...c.mensagens[0], corpo: c.mensagens[0].corpo.slice(0, TAMANHO_PREVIA_LISTA) }
        : null,
      naoLidas: c._count.mensagens,
    }));

    return { items };
  }

  /**
   * Devolve a thread asc e marca como lidas as mensagens do lado OPOSTO ao leitor
   * (`marcarLadoEquipe=true` quando quem lê é a família). Conversa sobre menor é
   * dado sensível — a leitura também entra na trilha de auditoria.
   */
  private async abrirThread(
    user: AuthenticatedUser,
    conversa: ConversaBasica,
    marcarLadoEquipe: boolean,
    contexto: string,
  ) {
    await this.prisma.mensagemFamilia.updateMany({
      where: { conversaId: conversa.id, ladoEquipe: marcarLadoEquipe, lidaEm: null },
      data: { lidaEm: new Date() },
    });

    // Janela das N mensagens mais recentes (desc + reverse → thread asc).
    // O recibo acima marca TODAS as não lidas da conversa, inclusive fora da
    // janela — débito aceito enquanto não há paginação por cursor.
    const mensagens = (
      await this.prisma.mensagemFamilia.findMany({
        where: { conversaId: conversa.id },
        orderBy: { criadoEm: "desc" },
        take: LIMITE_MENSAGENS_THREAD,
        select: {
          id: true,
          corpo: true,
          ladoEquipe: true,
          lidaEm: true,
          criadoEm: true,
          autor: { select: { nome: true } },
        },
      })
    ).reverse();

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "ConversaFamilia",
      entidadeId: conversa.id,
      metadados: { contexto, mensagens: mensagens.length },
    });

    return {
      id: conversa.id,
      crianca: { id: conversa.crianca.id, nome: conversa.crianca.nomeCompleto },
      mensagens: mensagens.map(({ autor, ...m }) => ({
        id: m.id,
        corpo: m.corpo,
        ladoEquipe: m.ladoEquipe,
        autorNome: autor.nome,
        lidaEm: m.lidaEm,
        criadoEm: m.criadoEm,
      })),
    };
  }

  private async enviarMensagem(
    user: AuthenticatedUser,
    conversaId: string,
    ladoEquipe: boolean,
    dto: CriarMensagemDto,
  ) {
    // Cinto e suspensório: o DTO já faz trim + 1..2000, mas o serviço revalida.
    const corpo = dto.corpo?.trim() ?? "";
    if (corpo.length === 0 || corpo.length > TAMANHO_MAXIMO_MENSAGEM) {
      throw new BadRequestException(
        `A mensagem deve ter entre 1 e ${TAMANHO_MAXIMO_MENSAGEM} caracteres.`,
      );
    }

    // Mensagem + toque no atualizadoEm da conversa (ordenação da lista) na mesma
    // transação: ou a atividade conta inteira, ou não conta.
    const [mensagem] = await this.prisma.$transaction([
      this.prisma.mensagemFamilia.create({
        data: { conversaId, autorId: user.id, ladoEquipe, corpo },
        select: {
          id: true,
          conversaId: true,
          corpo: true,
          ladoEquipe: true,
          lidaEm: true,
          criadoEm: true,
        },
      }),
      this.prisma.conversaFamilia.update({
        where: { id: conversaId },
        data: { atualizadoEm: new Date() },
      }),
    ]);

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.CREATE,
      entidade: "MensagemFamilia",
      entidadeId: mensagem.id,
      metadados: { conversaId, ladoEquipe },
    });

    return mensagem;
  }

  private formatarConversaBasica(conversa: ConversaBasica) {
    return {
      id: conversa.id,
      crianca: { id: conversa.crianca.id, nome: conversa.crianca.nomeCompleto },
      criadoEm: conversa.criadoEm,
    };
  }
}
