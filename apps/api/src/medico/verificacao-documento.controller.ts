import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Req,
  StreamableFile,
} from "@nestjs/common";
import { ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { AcaoAuditoria } from "@ifp/database";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { DocumentoPdfService } from "./documento-pdf.service";

const TIPO_LABEL: Record<string, string> = {
  ATESTADO: "Atestado médico",
  RECEITA: "Receituário médico",
  DECLARACAO: "Declaração",
};

/**
 * Verificação PÚBLICA de documento médico (anti-fraude) — sem autenticação,
 * molde da verificação de certificado/graduação. Não expõe dado clínico
 * sigiloso (sem CID, sem conteúdo da receita) — só o que valida o documento:
 * tipo, paciente, profissional e se está vigente/revogado.
 */
@ApiTags("medico")
@Controller("medico/documentos")
export class VerificacaoDocumentoController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: DocumentoPdfService,
    private readonly audit: AuditService,
  ) {}

  @Get("verificar/:codigo/pdf")
  @ApiOperation({ summary: "Baixa o documento em PDF com QR (público)" })
  @ApiParam({ name: "codigo", description: "código de verificação do documento" })
  async baixarPdf(
    @Param("codigo") codigo: string,
    @Req() req: Request,
  ): Promise<StreamableFile> {
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
  @ApiOperation({ summary: "Verifica a autenticidade de um documento médico (público)" })
  @ApiParam({ name: "codigo", description: "código impresso no documento" })
  async verificar(@Param("codigo") codigo: string, @Req() req: Request) {
    const doc = await this.prisma.documentoMedico.findUnique({
      where: { codigoVerificacao: codigo },
      include: {
        ficha: { select: { nomeCompleto: true } },
        membro: { select: { nomeCompleto: true } },
        profissional: {
          select: {
            registroConselho: true,
            ufConselho: true,
            user: { select: { nome: true } },
          },
        },
      },
    });
    if (!doc) {
      // Contrato público: 404 com { valido: false } (mesmo da Capacitação/Esportivo).
      throw new NotFoundException({
        valido: false,
        mensagem: "Documento não encontrado ou código inválido.",
      });
    }

    // Lê dado pessoal sem login — entra na trilha com ip/userAgent (LGPD).
    this.audit.registrar({
      acao: AcaoAuditoria.READ,
      entidade: "DocumentoMedico",
      entidadeId: doc.id,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      metadados: { contexto: "verificacao.publica", codigo: doc.codigoVerificacao },
    });

    return {
      valido: true,
      tipo: doc.tipo,
      tipoLabel: TIPO_LABEL[doc.tipo] ?? doc.tipo,
      paciente: doc.membro?.nomeCompleto ?? doc.ficha.nomeCompleto,
      profissional: doc.profissional.user.nome,
      registroConselho: doc.profissional.registroConselho
        ? `${doc.profissional.registroConselho}/${doc.profissional.ufConselho}`
        : null,
      emitidoEm: doc.emitidoEm,
      // Vigência é informação anti-fraude legítima (sem expor o motivo clínico).
      revogado: doc.revogadoEm != null,
      revogadoEm: doc.revogadoEm,
    };
  }
}
