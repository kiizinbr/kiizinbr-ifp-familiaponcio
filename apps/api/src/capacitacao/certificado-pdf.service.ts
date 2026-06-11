import { Injectable, NotFoundException } from "@nestjs/common";
import { AcaoAuditoria } from "@ifp/database";
import PDFDocument from "pdfkit";
import * as QRCode from "qrcode";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";

// Paleta CASA (mesma do tokens.css do web)
const TINTA = "#752C05";
const PAPEL = "#FAF7F2";
const DOURADO = "#C9962F";
const CORPO = "#4A4A49";

/**
 * Gera o certificado em PDF (A4 paisagem, papel timbrado CASA) com QR de
 * verificação pública. Endpoint é público pelo código não-adivinhável (cuid),
 * mesmo modelo da verificação; o download entra na trilha LGPD como EXPORT.
 */
@Injectable()
export class CertificadoPdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async gerar(
    codigo: string,
    origem?: { ip?: string | null; userAgent?: string | null },
  ): Promise<{ buffer: Buffer; filename: string }> {
    const cert = await this.prisma.certificado.findUnique({
      where: { codigoVerificacao: codigo },
      include: {
        matricula: {
          include: {
            ficha: { select: { nomeCompleto: true } },
            membro: { select: { nomeCompleto: true } },
            turma: {
              include: {
                curso: { select: { nome: true } },
                instrutor: { include: { user: { select: { nome: true } } } },
              },
            },
          },
        },
      },
    });
    if (!cert) {
      throw new NotFoundException("Certificado não encontrado ou código inválido.");
    }

    const aluno =
      cert.matricula.membro?.nomeCompleto ?? cert.matricula.ficha.nomeCompleto;
    const turma = cert.matricula.turma;
    const urlVerificacao = `${process.env.WEB_ORIGIN ?? "http://localhost:3000"}/verificar/${cert.codigoVerificacao}`;
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
      .text("INSTITUTO FAMÍLIA PONCIO", 0, 64, {
        align: "center",
        characterSpacing: 4,
      });
    doc
      .fontSize(11)
      .fillColor(CORPO)
      .text("Centro de Capacitação · Duque de Caxias/RJ", { align: "center" });

    doc
      .moveDown(1.2)
      .font("Helvetica-Bold")
      .fontSize(40)
      .fillColor(TINTA)
      .text("CERTIFICADO", { align: "center", characterSpacing: 8 });

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
      .text(aluno, { align: "center" });
    doc
      .moveDown(0.5)
      .font("Helvetica")
      .fontSize(14)
      .fillColor(CORPO)
      .text(
        `concluiu o curso de ${turma.curso.nome} — turma ${turma.codigo},`,
        { align: "center" },
      )
      .text(
        `com carga horária de ${cert.cargaHorariaCumprida} horas e ${Number(cert.presencaPct).toFixed(0)}% de presença.`,
        { align: "center" },
      );

    const dataEmissao = cert.emitidoEm.toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    doc
      .moveDown(1)
      .fontSize(12)
      .text(`Duque de Caxias/RJ, ${dataEmissao}.`, { align: "center" });

    // Assinaturas
    const yAss = H - 150;
    const linha = (x: number, nome: string, papel: string) => {
      doc.lineWidth(0.8).strokeColor(CORPO).moveTo(x, yAss).lineTo(x + 220, yAss).stroke();
      doc.font("Helvetica-Bold").fontSize(11).fillColor(CORPO).text(nome, x, yAss + 6, {
        width: 220,
        align: "center",
      });
      doc.font("Helvetica").fontSize(9).text(papel, x, yAss + 20, {
        width: 220,
        align: "center",
      });
    };
    linha(W / 2 - 280, turma.instrutor.user.nome, "Instrutor(a) responsável");
    linha(W / 2 + 60, "Instituto Família Poncio", "Direção do Centro de Capacitação");

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
      .text(`Código: ${cert.codigoVerificacao}`, 48, H - 58, { align: "left" });

    doc.end();
    const buffer = await fim;

    // Endpoint público: sem ip/userAgent a trilha do EXPORT seria anônima.
    this.audit.registrar({
      acao: AcaoAuditoria.EXPORT,
      entidade: "Certificado",
      entidadeId: cert.id,
      ip: origem?.ip,
      userAgent: origem?.userAgent,
      metadados: { formato: "pdf", codigo: cert.codigoVerificacao },
    });

    // Sanitiza o nome para o header Content-Disposition (aspas/acentos quebrariam o header).
    const slug =
      (aluno.split(" ")[0] ?? "aluno")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "") || "aluno";
    const filename = `certificado-${turma.codigo.replace(/[^a-zA-Z0-9-]/g, "")}-${slug}.pdf`;
    return { buffer, filename };
  }
}
