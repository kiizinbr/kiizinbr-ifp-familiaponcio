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
import { CertificadoPdfService } from "./certificado-pdf.service";

/**
 * Verificação PÚBLICA de certificado (anti-fraude) — sem autenticação,
 * pensada para o QR code impresso no certificado. Não expõe dado sensível
 * (sem CPF, sem protocolo) — só o que valida o documento.
 */
@ApiTags("capacitacao")
@Controller("capacitacao/certificados")
// Throttle dedicado (P1.5): rota PÚBLICA sem auth que expõe nome do aluno +
// curso. 20/min por IP fica acima do médico (dado menos sensível) mas bem
// abaixo do teto global (120/min), inviabilizando varredura por PII.
@Throttle({ default: { ttl: 60_000, limit: 20 } })
export class VerificacaoController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: CertificadoPdfService,
    private readonly audit: AuditService,
  ) {}

  @Get("verificar/:codigo/pdf")
  @ApiOperation({ summary: "Baixa o certificado em PDF com QR (público)" })
  @ApiParam({ name: "codigo", description: "código de verificação do certificado" })
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
  @ApiOperation({ summary: "Verifica a autenticidade de um certificado (público)" })
  @ApiParam({ name: "codigo", description: "código de verificação impresso no certificado" })
  async verificar(@Param("codigo") codigo: string, @Req() req: Request) {
    const cert = await this.prisma.certificado.findUnique({
      where: { codigoVerificacao: codigo },
      include: {
        matricula: {
          include: {
            ficha: { select: { nomeCompleto: true } },
            membro: { select: { nomeCompleto: true } },
            turma: { include: { curso: { select: { nome: true } } } },
          },
        },
      },
    });
    if (!cert) {
      // Contrato público: 404 com { valido: false } (consumido pela tela de verificação).
      throw new NotFoundException({
        valido: false,
        mensagem: "Certificado não encontrado ou código inválido.",
      });
    }

    // Lê o nome do beneficiário sem login — audita como o download do PDF.
    this.audit.registrar({
      acao: AcaoAuditoria.READ,
      entidade: "Certificado",
      entidadeId: cert.id,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      metadados: { contexto: "verificacao.publica", codigo: cert.codigoVerificacao },
    });

    return {
      valido: true,
      aluno: cert.matricula.membro?.nomeCompleto ?? cert.matricula.ficha.nomeCompleto,
      curso: cert.matricula.turma.curso.nome,
      turma: cert.matricula.turma.codigo,
      cargaHorariaCumprida: cert.cargaHorariaCumprida,
      presencaPct: Number(cert.presencaPct),
      emitidoEm: cert.emitidoEm,
    };
  }
}
