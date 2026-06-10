import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";

import { PrismaService } from "../prisma/prisma.service";

/**
 * Verificação PÚBLICA de certificado (anti-fraude) — sem autenticação,
 * pensada para o QR code impresso no certificado. Não expõe dado sensível
 * (sem CPF, sem protocolo) — só o que valida o documento.
 */
@ApiTags("capacitacao")
@Controller("capacitacao/certificados")
export class VerificacaoController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("verificar/:codigo")
  @ApiOperation({ summary: "Verifica a autenticidade de um certificado (público)" })
  @ApiParam({ name: "codigo", description: "código de verificação impresso no certificado" })
  async verificar(@Param("codigo") codigo: string) {
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
