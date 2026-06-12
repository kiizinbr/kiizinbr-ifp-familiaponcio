import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AcaoAuditoria, StatusDiario } from "@ifp/database";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/current-user.decorator";
import { ConversasService } from "./conversas.service";
import type { CriarConversaDto } from "./dto/criar-conversa.dto";
import type { CriarMensagemDto } from "./dto/criar-mensagem.dto";
import { janelaDoDiaSP } from "./dia-util";

const VERSAO_TERMO_VIGENTE = "v1-2026";

/**
 * Portal da família. Ownership SEMPRE por `User.fichaCidadaId` — o elo entre
 * o login do responsável e a ficha; nenhum endpoint aceita fichaId do client.
 * Diário só FECHADO, nunca rota pública (rotina de menor = dado sensível).
 */
@Injectable()
export class FamiliaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly conversasService: ConversasService,
  ) {}

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
  private async assertCriancaDaFamilia(user: AuthenticatedUser, membroId: string) {
    const fichaId = await this.resolverFichaId(user);
    const crianca = await this.prisma.membroFamiliar.findFirst({
      where: { id: membroId, fichaId },
      select: { id: true, nomeCompleto: true, dataNascimento: true },
    });
    if (!crianca) {
      throw new ForbiddenException("Esta criança não pertence à sua família.");
    }
    return { fichaId, crianca };
  }

  /** Crianças da família com matrícula infantil ativa (navegação do portal). */
  async minhasCriancas(user: AuthenticatedUser) {
    const fichaId = await this.resolverFichaId(user);
    const matriculas = await this.prisma.matriculaInfantil.findMany({
      where: { fichaId, ativa: true },
      include: {
        crianca: { select: { id: true, nomeCompleto: true, dataNascimento: true } },
        turma: { select: { id: true, nome: true } },
      },
    });
    return { items: matriculas };
  }

  /** Diário FECHADO do dia, por criança. Diário ABERTO não aparece (404 lógico). */
  async diario(user: AuthenticatedUser, membroId: string, data?: string) {
    const { crianca } = await this.assertCriancaDaFamilia(user, membroId);
    const { dataDb, dia, inicio, fim } = janelaDoDiaSP(data);

    const diario = await this.prisma.diarioDia.findFirst({
      where: {
        membroId,
        data: dataDb,
        status: StatusDiario.FECHADO, // selo: família só vê o dia fechado
      },
      include: {
        registros: { orderBy: { ocorridoEm: "asc" } },
        fechadoPor: { include: { user: { select: { nome: true } } } },
      },
    });

    const checks = await this.prisma.checkInOut.findMany({
      where: { membroId, ocorridoEm: { gte: inicio, lt: fim } },
      orderBy: { ocorridoEm: "asc" },
      include: { autorizado: { select: { nome: true, parentesco: true } } },
    });

    // Rotina de menor é dado sensível — leitura do responsável também é auditada.
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "DiarioDia",
      entidadeId: diario?.id ?? membroId,
      metadados: { contexto: "familia.diario", membroId, dia, encontrado: Boolean(diario) },
    });

    return { dia, crianca, diario, checks };
  }

  /** 3ª tela do portal: ficha da criança (autorizados + alergias + imagem). */
  async fichaCrianca(user: AuthenticatedUser, membroId: string) {
    const { crianca } = await this.assertCriancaDaFamilia(user, membroId);

    const [detalhe, autorizados, autorizacoesImagem] = await Promise.all([
      this.prisma.membroFamiliar.findUnique({
        where: { id: membroId },
        select: {
          id: true,
          nomeCompleto: true,
          dataNascimento: true,
          alergias: { where: { ativa: true } },
          condicoesCronicas: { where: { ativa: true } },
        },
      }),
      this.prisma.responsavelAutorizado.findMany({
        where: { membroId, revogadoEm: null },
        select: {
          id: true,
          nome: true,
          parentesco: true,
          fotoUrl: true,
          vigenteAte: true,
          restricaoJudicial: true,
        },
        orderBy: { nome: "asc" },
      }),
      this.prisma.autorizacaoImagem.findMany({
        where: { membroId, versaoTermo: VERSAO_TERMO_VIGENTE },
        select: { escopo: true, concedido: true, registradoEm: true, revogadoEm: true },
      }),
    ]);

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "MembroFamiliar",
      entidadeId: membroId,
      metadados: { contexto: "familia.fichaCrianca" },
    });

    return { crianca: detalhe ?? crianca, autorizados, autorizacoesImagem };
  }

  /** Comunicados das unidades onde a família tem criança matriculada. */
  async comunicados(user: AuthenticatedUser) {
    const fichaId = await this.resolverFichaId(user);
    const matriculas = await this.prisma.matriculaInfantil.findMany({
      where: { fichaId, ativa: true },
      select: { unidadeId: true, turmaId: true },
    });
    if (matriculas.length === 0) return { items: [] };

    const unidadeIds = [...new Set(matriculas.map((m) => m.unidadeId))];
    const turmaIds = [...new Set(matriculas.map((m) => m.turmaId))];

    const items = await this.prisma.comunicado.findMany({
      where: {
        unidadeId: { in: unidadeIds },
        OR: [{ turmaId: null }, { turmaId: { in: turmaIds } }],
      },
      orderBy: { criadoEm: "desc" },
      take: 50,
      include: {
        leituras: { where: { fichaId }, select: { lidoEm: true } },
      },
    });

    return {
      items: items.map(({ leituras, ...c }) => ({
        ...c,
        lidoEm: leituras[0]?.lidoEm ?? null,
      })),
    };
  }

  /** Confirmação de leitura (obrigatória nos críticos) — idempotente. */
  async confirmarLeitura(user: AuthenticatedUser, comunicadoId: string) {
    const fichaId = await this.resolverFichaId(user);
    const comunicado = await this.prisma.comunicado.findUnique({
      where: { id: comunicadoId },
      select: { id: true },
    });
    if (!comunicado) throw new NotFoundException("Comunicado não encontrado");

    const leitura = await this.prisma.comunicadoLeitura.upsert({
      where: { comunicadoId_fichaId: { comunicadoId, fichaId } },
      update: {},
      create: { comunicadoId, fichaId },
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.UPDATE,
      entidade: "Comunicado",
      entidadeId: comunicadoId,
      metadados: { acao: "confirmacaoLeitura" },
    });

    return leitura;
  }

  // ───── Mensagem 1:1 família↔instituto (delegada ao ConversasService) ─────

  /** Abre (get-or-create) a conversa de uma criança da própria família. */
  async abrirConversa(user: AuthenticatedUser, dto: CriarConversaDto) {
    const fichaId = await this.resolverFichaId(user);
    return this.conversasService.abrirConversaFamilia(fichaId, dto);
  }

  /** Conversas das crianças da ficha (não lidas = mensagens da equipe sem recibo). */
  async listarConversas(user: AuthenticatedUser) {
    const fichaId = await this.resolverFichaId(user);
    return this.conversasService.listarConversasFamilia(fichaId);
  }

  /** Thread da conversa; marca as mensagens da equipe como lidas (recibo). */
  async threadConversa(user: AuthenticatedUser, conversaId: string) {
    const fichaId = await this.resolverFichaId(user);
    return this.conversasService.abrirThreadFamilia(user, fichaId, conversaId);
  }

  /** Envia mensagem como responsável (ladoEquipe=false). */
  async enviarMensagem(user: AuthenticatedUser, conversaId: string, dto: CriarMensagemDto) {
    const fichaId = await this.resolverFichaId(user);
    return this.conversasService.enviarMensagemFamilia(user, fichaId, conversaId, dto);
  }
}
