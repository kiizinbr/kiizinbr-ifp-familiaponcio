import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AcaoAuditoria, StatusMatricula } from "@ifp/database";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/current-user.decorator";
import { CertificadoPdfService } from "../capacitacao/certificado-pdf.service";
import { GraduacaoPdfService } from "../esportivo/graduacao-pdf.service";

/**
 * Portal da família — "O que recebi" + galeria de conquistas.
 *
 * Reúne, num só lugar, tudo o que a família já recebeu do instituto nas
 * verticais (creche, capacitação, esporte, saúde) e a galeria de certificados
 * e graduações. Ownership SEMPRE por `User.fichaCidadaId` — nenhum endpoint
 * aceita fichaId do client (mesmo molde do FamiliaService). Sem model novo:
 * apenas agregações de leitura sobre o schema existente.
 */
@Injectable()
export class FamiliaRecebidoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly certificadoPdfService: CertificadoPdfService,
    private readonly graduacaoPdfService: GraduacaoPdfService,
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

  /**
   * Resumo de benefícios recebidos pela família (titular + dependentes),
   * agregando as verticais por `fichaId`. Tudo leitura; nada cross-família.
   */
  async recebido(user: AuthenticatedUser) {
    const fichaId = await this.resolverFichaId(user);

    const [
      matriculasInfantis,
      matriculasCapacitacao,
      matriculasEsportivas,
      certificadosCount,
      graduacoesCount,
      atendimentosSelados,
    ] = await Promise.all([
      // Creche / educação infantil
      this.prisma.matriculaInfantil.findMany({
        where: { fichaId, ativa: true },
        select: {
          id: true,
          crianca: { select: { id: true, nomeCompleto: true } },
          turma: { select: { id: true, nome: true } },
          unidade: { select: { id: true, nome: true } },
        },
      }),
      // Capacitação (cursos)
      this.prisma.matricula.findMany({
        where: { fichaId },
        select: {
          id: true,
          status: true,
          membro: { select: { id: true, nomeCompleto: true } },
          turma: {
            select: {
              id: true,
              codigo: true,
              curso: { select: { id: true, nome: true } },
            },
          },
          unidade: { select: { id: true, nome: true } },
          certificado: { select: { id: true } },
        },
      }),
      // Esporte (modalidades)
      this.prisma.matriculaEsportiva.findMany({
        where: { fichaId },
        select: {
          id: true,
          status: true,
          membro: { select: { id: true, nomeCompleto: true } },
          turma: {
            select: {
              id: true,
              codigo: true,
              modalidade: { select: { id: true, nome: true } },
            },
          },
          unidade: { select: { id: true, nome: true } },
          _count: { select: { graduacoes: true } },
        },
      }),
      // Conquistas formais (galeria)
      this.prisma.certificado.count({ where: { matricula: { fichaId } } }),
      this.prisma.graduacao.count({ where: { matricula: { fichaId } } }),
      // Saúde: nº de atendimentos selados (NÃO expõe conteúdo clínico aqui)
      this.prisma.atendimento.count({
        where: { fichaId, encerradoEm: { not: null } },
      }),
    ]);

    // Leitura agregada de dados da família — entra na trilha LGPD.
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "FichaCidada",
      entidadeId: fichaId,
      metadados: { contexto: "familia.recebido" },
    });

    const matriculasCapacitacaoAtivas = matriculasCapacitacao.filter(
      (m) => m.status === StatusMatricula.ATIVA,
    ).length;
    const matriculasEsportivasAtivas = matriculasEsportivas.filter(
      (m) => m.status === StatusMatricula.ATIVA,
    ).length;

    return {
      resumo: {
        creche: matriculasInfantis.length,
        capacitacao: matriculasCapacitacaoAtivas,
        esporte: matriculasEsportivasAtivas,
        certificados: certificadosCount,
        graduacoes: graduacoesCount,
        atendimentos: atendimentosSelados,
      },
      creche: matriculasInfantis,
      capacitacao: matriculasCapacitacao.map((m) => ({
        id: m.id,
        status: m.status,
        beneficiario: m.membro?.nomeCompleto ?? "Titular",
        curso: m.turma.curso.nome,
        turma: m.turma.codigo,
        unidade: m.unidade.nome,
        temCertificado: Boolean(m.certificado),
      })),
      esporte: matriculasEsportivas.map((m) => ({
        id: m.id,
        status: m.status,
        beneficiario: m.membro?.nomeCompleto ?? "Titular",
        modalidade: m.turma.modalidade.nome,
        turma: m.turma.codigo,
        unidade: m.unidade.nome,
        graduacoes: m._count.graduacoes,
      })),
    };
  }

  /**
   * Galeria de conquistas da família: certificados de capacitação +
   * graduações esportivas (ambos por `fichaId`). Cada item traz o
   * `codigoVerificacao` para verificação pública e o download de PDF.
   */
  async certificados(user: AuthenticatedUser) {
    const fichaId = await this.resolverFichaId(user);

    const [certificados, graduacoes] = await Promise.all([
      this.prisma.certificado.findMany({
        where: { matricula: { fichaId } },
        orderBy: { emitidoEm: "desc" },
        select: {
          id: true,
          codigoVerificacao: true,
          cargaHorariaCumprida: true,
          presencaPct: true,
          emitidoEm: true,
          matricula: {
            select: {
              membro: { select: { nomeCompleto: true } },
              ficha: { select: { nomeCompleto: true } },
              turma: {
                select: { codigo: true, curso: { select: { nome: true } } },
              },
            },
          },
        },
      }),
      this.prisma.graduacao.findMany({
        where: { matricula: { fichaId } },
        orderBy: { concedidaEm: "desc" },
        select: {
          id: true,
          codigoVerificacao: true,
          nivel: true,
          observacao: true,
          concedidaEm: true,
          matricula: {
            select: {
              membro: { select: { nomeCompleto: true } },
              ficha: { select: { nomeCompleto: true } },
              turma: {
                select: { codigo: true, modalidade: { select: { nome: true } } },
              },
            },
          },
        },
      }),
    ]);

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "FichaCidada",
      entidadeId: fichaId,
      metadados: {
        contexto: "familia.certificados",
        certificados: certificados.length,
        graduacoes: graduacoes.length,
      },
    });

    return {
      certificados: certificados.map((c) => ({
        id: c.id,
        codigoVerificacao: c.codigoVerificacao,
        beneficiario:
          c.matricula.membro?.nomeCompleto ?? c.matricula.ficha.nomeCompleto,
        curso: c.matricula.turma.curso.nome,
        turma: c.matricula.turma.codigo,
        cargaHorariaCumprida: c.cargaHorariaCumprida,
        presencaPct: Number(c.presencaPct),
        emitidoEm: c.emitidoEm,
      })),
      graduacoes: graduacoes.map((g) => ({
        id: g.id,
        codigoVerificacao: g.codigoVerificacao,
        beneficiario:
          g.matricula.membro?.nomeCompleto ?? g.matricula.ficha.nomeCompleto,
        modalidade: g.matricula.turma.modalidade.nome,
        turma: g.matricula.turma.codigo,
        nivel: g.nivel,
        observacao: g.observacao,
        concedidaEm: g.concedidaEm,
      })),
    };
  }

  /**
   * Gera o PDF de um certificado da PRÓPRIA família. Confere o ownership por
   * `fichaId` ANTES de gerar (IDOR): certificado de outra família → 404.
   * O download em si é auditado como EXPORT pelo CertificadoPdfService.
   */
  async certificadoPdf(
    user: AuthenticatedUser,
    codigo: string,
    origem?: { ip?: string | null; userAgent?: string | null },
  ): Promise<{ buffer: Buffer; filename: string }> {
    const fichaId = await this.resolverFichaId(user);

    const cert = await this.prisma.certificado.findUnique({
      where: { codigoVerificacao: codigo },
      select: { matricula: { select: { fichaId: true } } },
    });
    // Mesma resposta para "não existe" e "de outra família" — não vaza existência.
    if (!cert || cert.matricula.fichaId !== fichaId) {
      throw new NotFoundException("Certificado não encontrado.");
    }

    return this.certificadoPdfService.gerar(codigo, origem);
  }

  /**
   * Gera o DIPLOMA de graduação esportiva da PRÓPRIA família. Confere o
   * ownership por `fichaId` ANTES de gerar (IDOR): graduação de outra família
   * → 404 (mesma resposta de "não existe", não vaza existência). Reusa o
   * mesmo GraduacaoPdfService da verificação pública do Esportivo (Grupo A);
   * o download em si é auditado como EXPORT por aquele serviço.
   */
  async graduacaoPdf(
    user: AuthenticatedUser,
    codigo: string,
    origem?: { ip?: string | null; userAgent?: string | null },
  ): Promise<{ buffer: Buffer; filename: string }> {
    const fichaId = await this.resolverFichaId(user);

    const grad = await this.prisma.graduacao.findUnique({
      where: { codigoVerificacao: codigo },
      select: { matricula: { select: { fichaId: true } } },
    });
    // Mesma resposta para "não existe" e "de outra família" — não vaza existência.
    if (!grad || grad.matricula.fichaId !== fichaId) {
      throw new NotFoundException("Graduação não encontrada.");
    }

    return this.graduacaoPdfService.gerar(codigo, origem);
  }
}
