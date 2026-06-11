import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AcaoAuditoria, EscopoImagem, TipoUnidade } from "@ifp/database";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/current-user.decorator";
import { ProfissionaisService } from "../medico/profissionais.service";
import type { AtualizarAutorizacaoImagemDto } from "./dto/atualizar-autorizacao-imagem.dto";
import type { CriarAutorizadoDto } from "./dto/criar-autorizado.dto";

const VERSAO_TERMO_VIGENTE = "v1-2026";

@Injectable()
export class CriancasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly profissionais: ProfissionaisService,
  ) {}

  /** Tenant: a criança "pertence" à unidade se tem matrícula infantil ativa nela. */
  async assertCriancaDaUnidade(membroId: string, unidadeId: string) {
    const matricula = await this.prisma.matriculaInfantil.findFirst({
      where: { membroId, unidadeId, ativa: true },
      include: { turma: { select: { id: true, nome: true } } },
    });
    if (!matricula) {
      throw new ForbiddenException("Esta criança não está matriculada na sua unidade.");
    }
    return matricula;
  }

  /** Perfil da criança: alergias em destaque, autorizados, imagem, histórico de checks. */
  async perfil(user: AuthenticatedUser, membroId: string) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.EDUCACIONAL);
    const matricula = await this.assertCriancaDaUnidade(membroId, profissional.unidadeId);

    const crianca = await this.prisma.membroFamiliar.findUnique({
      where: { id: membroId },
      select: {
        id: true,
        nomeCompleto: true,
        dataNascimento: true,
        parentesco: true,
        alergias: { where: { ativa: true } },
        condicoesCronicas: { where: { ativa: true } },
        ficha: { select: { id: true, protocolo: true, nomeCompleto: true, telefone: true } },
      },
    });
    if (!crianca) throw new NotFoundException("Criança não encontrada");

    const [autorizados, autorizacoesImagem, ultimosChecks] = await Promise.all([
      this.prisma.responsavelAutorizado.findMany({
        where: { membroId },
        orderBy: [{ revogadoEm: "asc" }, { nome: "asc" }],
      }),
      this.prisma.autorizacaoImagem.findMany({
        where: { membroId, versaoTermo: VERSAO_TERMO_VIGENTE },
      }),
      this.prisma.checkInOut.findMany({
        where: { membroId },
        orderBy: { ocorridoEm: "desc" },
        take: 20,
        include: { autorizado: { select: { nome: true, parentesco: true } } },
      }),
    ]);

    // Dossiê de menor — leitura entra na trilha LGPD.
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "MembroFamiliar",
      entidadeId: membroId,
      metadados: { contexto: "educacional.perfilCrianca" },
    });

    return { crianca, matricula, autorizados, autorizacoesImagem, ultimosChecks };
  }

  async listarAutorizados(user: AuthenticatedUser, membroId: string) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.EDUCACIONAL);
    await this.assertCriancaDaUnidade(membroId, profissional.unidadeId);
    const items = await this.prisma.responsavelAutorizado.findMany({
      where: { membroId },
      orderBy: [{ revogadoEm: "asc" }, { nome: "asc" }],
    });
    return { items };
  }

  async criarAutorizado(user: AuthenticatedUser, membroId: string, dto: CriarAutorizadoDto) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.EDUCACIONAL);
    const matricula = await this.assertCriancaDaUnidade(membroId, profissional.unidadeId);

    const autorizado = await this.prisma.responsavelAutorizado.create({
      data: {
        fichaId: matricula.fichaId,
        membroId,
        nome: dto.nome,
        documento: dto.documento,
        parentesco: dto.parentesco,
        fotoUrl: dto.fotoUrl,
        vigenteAte: dto.vigenteAte ? new Date(dto.vigenteAte) : null,
        restricaoJudicial: dto.restricaoJudicial ?? false,
        criadoPor: user.id,
      },
    });

    // Quem pode retirar a criança é dado de segurança física — trilha obrigatória.
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.CREATE,
      entidade: "ResponsavelAutorizado",
      entidadeId: autorizado.id,
      metadados: { membroId, restricaoJudicial: autorizado.restricaoJudicial },
    });

    return autorizado;
  }

  /** Revogação: efeito imediato, registro preservado (trilha p/ disputa de guarda). */
  async revogarAutorizado(user: AuthenticatedUser, autorizadoId: string) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.EDUCACIONAL);
    const autorizado = await this.prisma.responsavelAutorizado.findUnique({
      where: { id: autorizadoId },
      select: { id: true, membroId: true, revogadoEm: true },
    });
    if (!autorizado) throw new NotFoundException("Autorizado não encontrado");
    await this.assertCriancaDaUnidade(autorizado.membroId, profissional.unidadeId);
    if (autorizado.revogadoEm) {
      throw new ConflictException("Esta autorização já foi revogada.");
    }

    const revogado = await this.prisma.responsavelAutorizado.update({
      where: { id: autorizadoId },
      data: { revogadoEm: new Date(), revogadoPor: user.id },
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.UPDATE,
      entidade: "ResponsavelAutorizado",
      entidadeId: autorizadoId,
      metadados: { acao: "revogacao", membroId: autorizado.membroId },
    });

    return revogado;
  }

  /** Concede/revoga autorização de imagem por escopo — nunca deleta (trilha no audit). */
  async atualizarAutorizacaoImagem(
    user: AuthenticatedUser,
    membroId: string,
    escopo: EscopoImagem,
    dto: AtualizarAutorizacaoImagemDto,
  ) {
    const profissional = await this.profissionais.resolverPorUser(user, TipoUnidade.EDUCACIONAL);
    const matricula = await this.assertCriancaDaUnidade(membroId, profissional.unidadeId);
    const versaoTermo = dto.versaoTermo ?? VERSAO_TERMO_VIGENTE;

    const autorizacao = await this.prisma.autorizacaoImagem.upsert({
      where: { membroId_escopo_versaoTermo: { membroId, escopo, versaoTermo } },
      update: {
        concedido: dto.concedido,
        revogadoEm: dto.concedido ? null : new Date(),
        revogadoPor: dto.concedido ? null : user.id,
      },
      create: {
        fichaId: matricula.fichaId,
        membroId,
        escopo,
        concedido: dto.concedido,
        versaoTermo,
        criadoPor: user.id,
      },
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.UPDATE,
      entidade: "AutorizacaoImagem",
      entidadeId: autorizacao.id,
      metadados: { membroId, escopo, concedido: dto.concedido, versaoTermo },
    });

    return autorizacao;
  }
}
