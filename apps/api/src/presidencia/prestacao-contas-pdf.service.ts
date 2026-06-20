import { Injectable } from "@nestjs/common";
import { AcaoAuditoria } from "@ifp/database";
import PDFDocument from "pdfkit";

import { AuditService } from "../audit/audit.service";
import type { AuthenticatedUser } from "../auth/current-user.decorator";
import { PresidenciaService } from "./presidencia.service";

// Paleta CASA (mesma do tokens.css do web / certificado)
const TINTA = "#752C05";
const PAPEL = "#FAF7F2";
const DOURADO = "#C9962F";
const CORPO = "#4A4A49";

/**
 * Gera a Prestação de Contas em PDF (A4 retrato, papel timbrado CASA) a partir
 * dos NÚMEROS REAIS do período — sem IA. Texto-resumo é determinístico (gerado
 * dos próprios números), nunca rotulado como redigido por IA. Download = EXPORT
 * na trilha LGPD.
 */
@Injectable()
export class PrestacaoContasPdfService {
  constructor(
    private readonly presidencia: PresidenciaService,
    private readonly audit: AuditService,
  ) {}

  async gerar(
    user: AuthenticatedUser,
    chave?: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const data = await this.presidencia.agregarPrestacao(chave);

    const doc = new PDFDocument({ size: "A4", margin: 0 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    const fim = new Promise<Buffer>((resolve) =>
      doc.on("end", () => resolve(Buffer.concat(chunks))),
    );

    const W = doc.page.width; // ~595
    const H = doc.page.height; // ~842
    const M = 56; // margem útil

    // Fundo papel + moldura dupla
    doc.rect(0, 0, W, H).fill(PAPEL);
    doc.lineWidth(3).strokeColor(TINTA).rect(24, 24, W - 48, H - 48).stroke();
    doc.lineWidth(1).strokeColor(DOURADO).rect(32, 32, W - 64, H - 64).stroke();

    // Cabeçalho
    doc
      .fillColor(TINTA)
      .font("Helvetica")
      .fontSize(11)
      .text("INSTITUTO FAMÍLIA PONCIO", 0, 60, { align: "center", characterSpacing: 4 });
    doc
      .moveDown(0.8)
      .font("Helvetica-Bold")
      .fontSize(26)
      .fillColor(TINTA)
      .text("PRESTAÇÃO DE CONTAS", { align: "center", characterSpacing: 2 });
    doc
      .moveDown(0.3)
      .font("Helvetica")
      .fontSize(12)
      .fillColor(CORPO)
      .text(data.periodo.label, { align: "center" });

    const hoje = new Date().toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    doc
      .moveDown(0.2)
      .fontSize(9)
      .fillColor(CORPO)
      .text(`Documento gerado em ${hoje}`, { align: "center" });

    // Texto-resumo (determinístico, a partir dos números reais)
    const resumo =
      `No período (${data.periodo.label.toLowerCase()}), o Instituto acolheu ` +
      `${data.novas.familias} ${data.novas.familias === 1 ? "nova família" : "novas famílias"} ` +
      `e realizou ${data.realizados.atendimentos} ` +
      `${data.realizados.atendimentos === 1 ? "atendimento" : "atendimentos"}. ` +
      `A base atual soma ${data.base.familiasAtendidas} famílias atendidas ` +
      `(${data.base.pessoasImpactadas} pessoas), das quais ${data.base.cross2maisPct}% ` +
      `são acompanhadas por duas ou mais unidades.`;
    doc
      .moveDown(1.4)
      .font("Helvetica")
      .fontSize(11.5)
      .fillColor(CORPO)
      .text(resumo, M, doc.y, { width: W - M * 2, align: "justify", lineGap: 3 });

    // ----- Tabela: Números do período -----
    let y = doc.y + 26;
    const linha = (rotulo: string, valor: string, destaque = false) => {
      doc
        .font(destaque ? "Helvetica-Bold" : "Helvetica")
        .fontSize(destaque ? 12 : 11)
        .fillColor(destaque ? TINTA : CORPO)
        .text(rotulo, M, y, { width: W - M * 2 - 90, continued: false });
      doc
        .font("Helvetica-Bold")
        .fontSize(destaque ? 13 : 12)
        .fillColor(TINTA)
        .text(valor, W - M - 90, y, { width: 90, align: "right" });
      y += destaque ? 26 : 22;
      doc.lineWidth(0.5).strokeColor("#E5D8CC").moveTo(M, y - 6).lineTo(W - M, y - 6).stroke();
    };
    const secao = (titulo: string) => {
      y += 8;
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(DOURADO)
        .text(titulo.toUpperCase(), M, y, { characterSpacing: 1.5 });
      y += 20;
    };
    const n = (v: number) => v.toLocaleString("pt-BR");

    secao("Números do período");
    linha("Famílias acolhidas", n(data.novas.familias));
    linha("Novas matrículas", n(data.novas.matriculas));
    linha("Atendimentos realizados", n(data.realizados.atendimentos));
    linha("Certificados emitidos", n(data.realizados.certificados));
    linha("Graduações concedidas", n(data.realizados.graduacoes));

    secao("Base atual (acumulado)");
    linha("Famílias atendidas", n(data.base.familiasAtendidas), true);
    linha("Pessoas impactadas", n(data.base.pessoasImpactadas), true);
    linha(
      "Famílias em 2+ unidades",
      `${n(data.base.cross2mais)} (${data.base.cross2maisPct}%)`,
      true,
    );

    // ----- Selo da Coroa (rodapé) -----
    const seloY = H - 150;
    const seloX = W / 2;
    doc.lineWidth(1.5).strokeColor(DOURADO).circle(seloX, seloY, 30).stroke();
    doc.lineWidth(0.6).strokeColor(DOURADO).circle(seloX, seloY, 24).stroke();
    doc
      .font("Helvetica-Bold")
      .fontSize(14)
      .fillColor(TINTA)
      .text("IFP", seloX - 30, seloY - 7, { width: 60, align: "center" });
    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(CORPO)
      .text(
        "Documento gerado pelo IFP Connect a partir dos dados operacionais do Instituto.",
        M,
        seloY + 46,
        { width: W - M * 2, align: "center" },
      );

    doc.end();
    const buffer = await fim;

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.EXPORT,
      entidade: "PrestacaoContas",
      entidadeId: data.periodo.chave,
      metadados: { formato: "pdf", periodo: data.periodo.chave },
    });

    const filename = `prestacao-contas-${data.periodo.chave}.pdf`;
    return { buffer, filename };
  }
}
