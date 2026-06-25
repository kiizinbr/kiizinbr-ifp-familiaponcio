import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Req,
  StreamableFile,
} from "@nestjs/common";
import { ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { AcaoAuditoria } from "@ifp/database";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { GraduacaoPdfService } from "./graduacao-pdf.service";

/**
 * Verificação PÚBLICA de graduação (anti-fraude) — sem autenticação, molde
 * da verificação de certificado da Capacitação. Não expõe dado sensível
 * (sem CPF, sem protocolo) — só o que valida a graduação.
 */
@ApiTags("esportivo")
@Controller("esportivo/graduacoes")
// Throttle dedicado (P1.5): rota PÚBLICA sem auth que expõe nome do atleta +
// modalidade/nível. 20/min por IP fica acima do médico (dado menos sensível)
// mas bem abaixo do teto global (120/min), inviabilizando varredura por PII.
@Throttle({ default: { ttl: 60_000, limit: 20 } })
export class VerificacaoGraduacaoController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: GraduacaoPdfService,
    private readonly audit: AuditService,
  ) {}

  @Get("verificar/:codigo/pdf")
  @ApiOperation({ summary: "Baixa o diploma de graduação em PDF com QR (público)" })
  @ApiParam({ name: "codigo", description: "código de verificação da graduação" })
  async baixarPdf(
    @Param("codigo") codigo: string,
    @Req() req: Request,
  ): Promise<StreamableFile> {
    // Endpoint público: a trilha sem ip/userAgent seria anônima e inútil (LGPD).
    const { buffer, filename } = await this.pdf.gerar(codigo, {
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });
    return new StreamableFile(buffer, {
      type: "application/pdf",
      disposition: `inline; filename="${filename}"`,
    });
  }

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
