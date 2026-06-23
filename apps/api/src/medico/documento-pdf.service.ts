import { Injectable, NotFoundException } from "@nestjs/common";
import { AcaoAuditoria, TipoDocumentoMedico } from "@ifp/database";
import PDFDocument from "pdfkit";
import * as QRCode from "qrcode";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";

// Paleta CASA (mesma do tokens.css do web / do certificado da Capacitação)
const TINTA = "#752C05";
const PAPEL = "#FAF7F2";
const DOURADO = "#C9962F";
const CORPO = "#4A4A49";

const TITULO: Record<TipoDocumentoMedico, string> = {
  ATESTADO: "ATESTADO MÉDICO",
  RECEITA: "RECEITUÁRIO MÉDICO",
  DECLARACAO: "DECLARAÇÃO",
};

/**
 * Gera o documento médico (A4 retrato, papel timbrado CASA) com QR de
 * verificação pública — mesmo padrão do certificado. Reusa pdfkit + qrcode.
 * Endpoint é público pelo código não-adivinhável (cuid); o download entra na
 * trilha LGPD como EXPORT. Documento revogado é marcado em vermelho no PDF.
 */
@Injectable()
export class DocumentoPdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async gerar(
    codigo: string,
    origem?: { ip?: string | null; userAgent?: string | null },
  ): Promise<{ buffer: Buffer; filename: string }> {
    const doc = await this.prisma.documentoMedico.findUnique({
      where: { codigoVerificacao: codigo },
      include: {
        ficha: { select: { nomeCompleto: true, protocolo: true } },
        membro: { select: { nomeCompleto: true } },
        profissional: {
          select: {
            registroConselho: true,
            ufConselho: true,
            especialidade: true,
            user: { select: { nome: true } },
          },
        },
      },
    });
    if (!doc) {
      throw new NotFoundException("Documento não encontrado ou código inválido.");
    }

    const paciente = doc.membro?.nomeCompleto ?? doc.ficha.nomeCompleto;
    const profissionalNome = doc.profissional.user.nome;
    const conselho = doc.profissional.registroConselho
      ? `${doc.profissional.registroConselho}/${doc.profissional.ufConselho}`
      : null;
    const urlVerificacao = `${process.env.WEB_ORIGIN ?? "http://localhost:3000"}/verificar-documento/${doc.codigoVerificacao}`;
    const qrPng = await QRCode.toBuffer(urlVerificacao, { width: 220, margin: 1 });

    const pdf = new PDFDocument({ size: "A4", layout: "portrait", margin: 0 });
    const chunks: Buffer[] = [];
    pdf.on("data", (c: Buffer) => chunks.push(c));
    const fim = new Promise<Buffer>((resolve) =>
      pdf.on("end", () => resolve(Buffer.concat(chunks))),
    );

    const W = pdf.page.width; // ~595
    const H = pdf.page.height; // ~842
    const M = 56; // margem útil

    // Fundo papel + moldura dupla em tinta
    pdf.rect(0, 0, W, H).fill(PAPEL);
    pdf.lineWidth(2.5).strokeColor(TINTA).rect(28, 28, W - 56, H - 56).stroke();
    pdf.lineWidth(0.8).strokeColor(DOURADO).rect(36, 36, W - 72, H - 72).stroke();

    // Cabeçalho institucional
    pdf
      .fillColor(TINTA)
      .font("Helvetica")
      .fontSize(13)
      .text("INSTITUTO FAMÍLIA PONCIO", 0, 70, { align: "center", characterSpacing: 3 });
    pdf
      .fontSize(10)
      .fillColor(CORPO)
      .text("Centro Médico · Duque de Caxias/RJ", { align: "center" });

    // Título do documento
    pdf
      .moveDown(2)
      .font("Helvetica-Bold")
      .fontSize(26)
      .fillColor(TINTA)
      .text(TITULO[doc.tipo], { align: "center", characterSpacing: 4 });

    // Selo de revogado (faixa vermelha) se for o caso
    if (doc.revogadoEm) {
      pdf
        .moveDown(0.6)
        .font("Helvetica-Bold")
        .fontSize(13)
        .fillColor("#B91C1C")
        .text("— DOCUMENTO REVOGADO —", { align: "center" });
    }

    // Identificação do paciente
    pdf
      .moveDown(1.5)
      .font("Helvetica")
      .fontSize(12)
      .fillColor(CORPO)
      .text(`Paciente: `, M, pdf.y, { continued: true })
      .font("Helvetica-Bold")
      .fillColor(TINTA)
      .text(paciente);
    pdf
      .font("Helvetica")
      .fontSize(10)
      .fillColor(CORPO)
      .text(`Protocolo: ${doc.ficha.protocolo}`, M);

    // Corpo (texto livre)
    pdf
      .moveDown(1.2)
      .font("Helvetica")
      .fontSize(12)
      .fillColor(CORPO)
      .text(doc.conteudo, M, pdf.y, {
        width: W - M * 2,
        align: "justify",
        lineGap: 4,
      });

    // Dias de afastamento (atestado)
    if (doc.diasAfastamento) {
      pdf
        .moveDown(0.8)
        .font("Helvetica-Bold")
        .fontSize(12)
        .fillColor(TINTA)
        .text(`Afastamento: ${doc.diasAfastamento} dia(s).`, M);
    }
    // CID (sigiloso — só no PDF do documento, nunca na verificação pública)
    if (doc.cid10) {
      pdf
        .font("Helvetica")
        .fontSize(10)
        .fillColor(CORPO)
        .text(`CID-10: ${doc.cid10}`, M);
    }

    const dataEmissao = doc.emitidoEm.toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    pdf
      .moveDown(1.5)
      .font("Helvetica")
      .fontSize(11)
      .fillColor(CORPO)
      .text(`Duque de Caxias/RJ, ${dataEmissao}.`, M);

    // Assinatura do profissional
    const yAss = H - 200;
    pdf
      .lineWidth(0.8)
      .strokeColor(CORPO)
      .moveTo(W / 2 - 120, yAss)
      .lineTo(W / 2 + 120, yAss)
      .stroke();
    pdf
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(CORPO)
      .text(profissionalNome, W / 2 - 120, yAss + 6, { width: 240, align: "center" });
    if (conselho || doc.profissional.especialidade) {
      pdf
        .font("Helvetica")
        .fontSize(9)
        .text(
          [doc.profissional.especialidade, conselho].filter(Boolean).join(" · "),
          W / 2 - 120,
          yAss + 20,
          { width: 240, align: "center" },
        );
    }

    // QR + código de verificação (canto inferior direito)
    const qrX = W - 150;
    const qrY = H - 130;
    pdf.image(qrPng, qrX, qrY, { width: 80, height: 80 });
    pdf
      .font("Helvetica")
      .fontSize(7)
      .fillColor(CORPO)
      .text("Verifique a autenticidade:", qrX - 18, qrY + 82, { width: 116, align: "center" })
      .text(urlVerificacao.replace(/^https?:\/\//, ""), qrX - 18, qrY + 91, {
        width: 116,
        align: "center",
      });
    pdf
      .fontSize(8)
      .fillColor(DOURADO)
      .text(`Código: ${doc.codigoVerificacao}`, M, H - 62, { align: "left" });

    pdf.end();
    const buffer = await fim;

    this.audit.registrar({
      acao: AcaoAuditoria.EXPORT,
      entidade: "DocumentoMedico",
      entidadeId: doc.id,
      ip: origem?.ip,
      userAgent: origem?.userAgent,
      metadados: { formato: "pdf", tipo: doc.tipo, codigo: doc.codigoVerificacao },
    });

    const slug =
      (paciente.split(" ")[0] ?? "paciente")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "") || "paciente";
    const filename = `${doc.tipo.toLowerCase()}-${slug}.pdf`;
    return { buffer, filename };
  }
}
