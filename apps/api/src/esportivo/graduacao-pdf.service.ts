import { Injectable, NotFoundException } from "@nestjs/common";
import { AcaoAuditoria } from "@ifp/database";
import PDFDocument from "pdfkit";
import * as QRCode from "qrcode";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";

// Paleta CASA (mesma do certificado da Capacitação / tokens.css do web)
const TINTA = "#752C05";
const PAPEL = "#FAF7F2";
const DOURADO = "#C9962F";
const CORPO = "#4A4A49";

/**
 * Gera o DIPLOMA de graduação esportiva em PDF (A4 paisagem, papel timbrado
 * CASA) com QR de verificação pública. Molde do certificado da Capacitação:
 * endpoint público pelo código não-adivinhável (cuid); o download entra na
 * trilha LGPD como EXPORT.
 */
@Injectable()
export class GraduacaoPdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async gerar(
    codigo: string,
    origem?: { ip?: string | null; userAgent?: string | null },
  ): Promise<{ buffer: Buffer; filename: string }> {
    const grad = await this.prisma.graduacao.findUnique({
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
    if (!grad) {
      throw new NotFoundException("Graduação não encontrada ou código inválido.");
    }

    const atleta = grad.matricula.membro?.nomeCompleto ?? grad.matricula.ficha.nomeCompleto;
    const modalidade = grad.matricula.turma.modalidade.nome;
    const turmaCodigo = grad.matricula.turma.codigo;
    const urlVerificacao = `${process.env.WEB_ORIGIN ?? "http://localhost:3000"}/verificar-graduacao/${grad.codigoVerificacao}`;
    const qrPng = await QRCode.toBuffer(urlVerificacao, { width: 220, margin: 1 });

    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 0 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    const fim = new Promise<Buffer>((resolve) =>
      doc.on("end", () => resolve(Buffer.concat(chunks))),
    );

    const W = doc.page.width; // ~842
    const H = doc.page.height; // ~595

    // Fundo papel + moldura dupla em tinta
    doc.rect(0, 0, W, H).fill(PAPEL);
    doc.lineWidth(3).strokeColor(TINTA).rect(24, 24, W - 48, H - 48).stroke();
    doc.lineWidth(1).strokeColor(DOURADO).rect(32, 32, W - 64, H - 64).stroke();

    // Cabeçalho institucional
    doc
      .fillColor(TINTA)
      .font("Helvetica")
      .fontSize(12)
      .text("INSTITUTO FAMÍLIA PONCIO", 0, 64, { align: "center", characterSpacing: 4 });
    doc
      .fontSize(11)
      .fillColor(CORPO)
      .text("Centro Esportivo · Duque de Caxias/RJ", { align: "center" });

    doc
      .moveDown(1.2)
      .font("Helvetica-Bold")
      .fontSize(36)
      .fillColor(TINTA)
      .text("DIPLOMA DE GRADUAÇÃO", { align: "center", characterSpacing: 6 });

    // Corpo
    doc
      .moveDown(1)
      .font("Helvetica")
      .fontSize(14)
      .fillColor(CORPO)
      .text("Certificamos que", { align: "center" });
    doc
      .moveDown(0.4)
      .font("Helvetica-Bold")
      .fontSize(28)
      .fillColor(TINTA)
      .text(atleta, { align: "center" });
    doc
      .moveDown(0.5)
      .font("Helvetica")
      .fontSize(14)
      .fillColor(CORPO)
      .text(`conquistou a graduação`, { align: "center" });
    doc
      .moveDown(0.3)
      .font("Helvetica-Bold")
      .fontSize(22)
      .fillColor(DOURADO)
      .text(grad.nivel, { align: "center" });
    doc
      .moveDown(0.4)
      .font("Helvetica")
      .fontSize(14)
      .fillColor(CORPO)
      .text(`na modalidade ${modalidade} — turma ${turmaCodigo}.`, { align: "center" });

    const dataConcessao = grad.concedidaEm.toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    doc
      .moveDown(1)
      .fontSize(12)
      .text(`Duque de Caxias/RJ, ${dataConcessao}.`, { align: "center" });

    // Assinaturas
    const yAss = H - 150;
    const linha = (x: number, nome: string, papel: string) => {
      doc.lineWidth(0.8).strokeColor(CORPO).moveTo(x, yAss).lineTo(x + 220, yAss).stroke();
      doc.font("Helvetica-Bold").fontSize(11).fillColor(CORPO).text(nome, x, yAss + 6, {
        width: 220,
        align: "center",
      });
      doc.font("Helvetica").fontSize(9).text(papel, x, yAss + 20, { width: 220, align: "center" });
    };
    linha(W / 2 - 280, "Instrutor(a) responsável", "Centro Esportivo");
    linha(W / 2 + 60, "Instituto Família Poncio", "Direção do Centro Esportivo");

    // QR + código de verificação (canto inferior direito)
    const qrX = W - 150;
    const qrY = H - 168;
    doc.image(qrPng, qrX, qrY, { width: 96, height: 96 });
    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor(CORPO)
      .text("Verifique a autenticidade:", qrX - 10, qrY + 100, { width: 116, align: "center" })
      .text(urlVerificacao.replace(/^https?:\/\//, ""), qrX - 10, qrY + 110, {
        width: 116,
        align: "center",
      });
    doc
      .fontSize(8)
      .fillColor(DOURADO)
      .text(`Código: ${grad.codigoVerificacao}`, 48, H - 58, { align: "left" });

    doc.end();
    const buffer = await fim;

    // Endpoint público: sem ip/userAgent a trilha do EXPORT seria anônima.
    this.audit.registrar({
      acao: AcaoAuditoria.EXPORT,
      entidade: "Graduacao",
      entidadeId: grad.id,
      ip: origem?.ip,
      userAgent: origem?.userAgent,
      metadados: { formato: "pdf", codigo: grad.codigoVerificacao },
    });

    // Sanitiza o nome para o header Content-Disposition (aspas/acentos quebrariam o header).
    const slug =
      (atleta.split(" ")[0] ?? "atleta")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "") || "atleta";
    const filename = `diploma-${modalidade.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "")}-${slug}.pdf`;
    return { buffer, filename };
  }
}
