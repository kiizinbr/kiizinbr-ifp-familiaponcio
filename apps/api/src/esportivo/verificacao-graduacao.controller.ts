import { Controller, Get, NotFoundException, Param, Req } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { AcaoAuditoria } from "@ifp/database";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Verificação PÚBLICA de graduação (anti-fraude) — sem autenticação, molde
 * da verificação de certificado da Capacitação. Não expõe dado sensível
 * (sem CPF, sem protocolo) — só o que valida a graduação.
 */
@ApiTags("esportivo")
@Controller("esportivo/graduacoes")
export class VerificacaoGraduacaoController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get("verificar/:codigo")
  @ApiOperation({ summary: "Verifica a autenticidade de uma graduação (público)" })
  @ApiParam({ name: "codigo", description: "código de verificação da graduação" })
  async verificar(@Param("codigo") codigo: string, @Req() req: Request) {
    const graduacao = await this.prisma.graduacao.findUnique({
      where: { codigoVerificacao: codigo },
      include: {
        matricula: {
          include: {
            ficha: { select: { nomeCompleto: true } },
            membro: { select: { nomeCompleto: true } },
            turma: { include: { modalidade: { select: { nome: true } } } },
          },
        },
      },
    });
    if (!graduacao) {
      // Contrato público: 404 com { valido: false } (mesmo da Capacitação).
      throw new NotFoundException({
        valido: false,
        mensagem: "Graduação não encontrada ou código inválido.",
      });
    }

    // Lê o nome do atleta sem login — entra na trilha com ip/userAgent (LGPD).
    this.audit.registrar({
      acao: AcaoAuditoria.READ,
      entidade: "Graduacao",
      entidadeId: graduacao.id,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      metadados: { contexto: "verificacao.publica", codigo: graduacao.codigoVerificacao },
    });

    return {
      valido: true,
      atleta:
        graduacao.matricula.membro?.nomeCompleto ??
        graduacao.matricula.ficha.nomeCompleto,
      modalidade: graduacao.matricula.turma.modalidade.nome,
      turma: graduacao.matricula.turma.codigo,
      nivel: graduacao.nivel,
      concedidaEm: graduacao.concedidaEm,
    };
  }
}
