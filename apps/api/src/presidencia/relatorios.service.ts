import { Injectable, NotFoundException } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { AcaoAuditoria, TipoRelatorio } from "@ifp/database";
import PDFDocument from "pdfkit";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/current-user.decorator";
import { PresidenciaService } from "./presidencia.service";

// Paleta CASA (mesma do prestacao-contas-pdf.service / tokens.css do web)
const TINTA = "#752C05";
const PAPEL = "#FAF7F2";
const DOURADO = "#C9962F";
const CORPO = "#4A4A49";

const TIPOS_VALIDOS: TipoRelatorio[] = [
  TipoRelatorio.PRESTACAO_CONTAS,
  TipoRelatorio.IMPACTO,
];

const TIPO_LABEL: Record<TipoRelatorio, string> = {
  PRESTACAO_CONTAS: "Prestação de Contas",
  IMPACTO: "Relatório de Impacto",
};

/**
 * Relatórios institucionais SELADOS em PDF da Presidência. Reusa o gerador
 * pdfkit + o selo CASA da prestação de contas. O PDF NÃO é guardado: o banco
 * guarda só o manifesto (tipo, período, quem gerou, quando, código/hash) e o
 * documento é regerado a partir dos números REAIS quando baixado. Tudo é
 * agregado/anônimo — nada de IA. Geração e download entram na trilha LGPD
 * como EXPORT.
 */
@Injectable()
export class RelatoriosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presidencia: PresidenciaService,
    private readonly audit: AuditService,
  ) {}

  private normalizarTipo(valor?: string): TipoRelatorio {
    const t = (valor ?? "").toUpperCase();
    return TIPOS_VALIDOS.includes(t as TipoRelatorio)
      ? (t as TipoRelatorio)
      : TipoRelatorio.PRESTACAO_CONTAS;
  }

  private normalizarPeriodo(valor?: string): "mes" | "ano" | "12m" {
    return valor === "mes" || valor === "ano" || valor === "12m" ? valor : "12m";
  }

  // ============================================================
  // Listar — manifesto dos relatórios já gerados (mais recentes primeiro)
  // ============================================================
  async listar(user: AuthenticatedUser) {
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "RelatorioPDF",
      entidadeId: "lista",
    });

    const itens = await this.prisma.relatorioPDF.findMany({
      orderBy: { geradoEm: "desc" },
      take: 100,
    });

    return {
      total: itens.length,
      itens: itens.map((r) => ({
        id: r.id,
        tipo: r.tipo,
        tipoLabel: TIPO_LABEL[r.tipo],
        periodo: r.periodo,
        titulo: r.titulo,
        geradoPorNome: r.geradoPorNome,
        geradoEm: r.geradoEm.toISOString(),
        codigo: r.codigo,
      })),
    };
  }

  // ============================================================
  // Gerar — calcula os números, sela e persiste o manifesto
  // ============================================================
  async gerar(
    user: AuthenticatedUser,
    body: { tipo?: string; periodo?: string },
    origem?: { ip?: string | null; userAgent?: string | null },
  ) {
    const tipo = this.normalizarTipo(body.tipo);
    const periodo = this.normalizarPeriodo(body.periodo);
    const dados = await this.presidencia.agregarPrestacao(periodo);

    // "Número de fechamento": soma estável que representa o conteúdo do
    // relatório naquele momento — entra no hash para selar o documento.
    const fechamento =
      dados.novas.familias +
      dados.realizados.atendimentos +
      dados.base.familiasAtendidas +
      dados.base.pessoasImpactadas;

    const codigo = this.gerarCodigo();
    const hash = createHash("sha256")
      .update(`${tipo}|${periodo}|${fechamento}|${codigo}`)
      .digest("hex")
      .slice(0, 16);

    const titulo = `${TIPO_LABEL[tipo]} — ${dados.periodo.label}`;

    const registro = await this.prisma.relatorioPDF.create({
      data: {
        tipo,
        periodo,
        titulo,
        geradoPorId: user.id,
        geradoPorNome: user.email ?? "Presidência",
        codigo,
        hash,
      },
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.EXPORT,
      entidade: "RelatorioPDF",
      entidadeId: registro.id,
      ip: origem?.ip,
      userAgent: origem?.userAgent,
      metadados: { evento: "gerar", tipo, periodo, codigo },
    });

    return {
      id: registro.id,
      tipo: registro.tipo,
      tipoLabel: TIPO_LABEL[registro.tipo],
      periodo: registro.periodo,
      titulo: registro.titulo,
      geradoPorNome: registro.geradoPorNome,
      geradoEm: registro.geradoEm.toISOString(),
      codigo: registro.codigo,
    };
  }

  // ============================================================
  // Baixar — regenera o PDF selado a partir do manifesto + números reais
  // ============================================================
  async baixar(
    user: AuthenticatedUser,
    id: string,
    origem?: { ip?: string | null; userAgent?: string | null },
  ): Promise<{ buffer: Buffer; filename: string }> {
    const registro = await this.prisma.relatorioPDF.findUnique({ where: { id } });
    if (!registro) {
      throw new NotFoundException("Relatório não encontrado.");
    }

    const dados = await this.presidencia.agregarPrestacao(registro.periodo);
    const buffer = await this.renderizar(registro, dados);

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.EXPORT,
      entidade: "RelatorioPDF",
      entidadeId: registro.id,
      ip: origem?.ip,
      userAgent: origem?.userAgent,
      metadados: { evento: "baixar", tipo: registro.tipo, codigo: registro.codigo },
    });

    const filename = `relatorio-${registro.tipo.toLowerCase()}-${registro.codigo}.pdf`;
    return { buffer, filename };
  }

  // ============================================================
  // Render do PDF (A4, papel timbrado CASA + selo da Coroa)
  // ============================================================
  private renderizar(
    registro: { tipo: TipoRelatorio; codigo: string; hash: string; geradoPorNome: string },
    dados: Awaited<ReturnType<PresidenciaService["agregarPrestacao"]>>,
  ): Promise<Buffer> {
    const doc = new PDFDocument({ size: "A4", margin: 0 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    const fim = new Promise<Buffer>((resolve) =>
      doc.on("end", () => resolve(Buffer.concat(chunks))),
    );

    const W = doc.page.width; // ~595
    const H = doc.page.height; // ~842
    const M = 56;

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
      .fontSize(24)
      .fillColor(TINTA)
      .text(TIPO_LABEL[registro.tipo].toUpperCase(), { align: "center", characterSpacing: 1.5 });
    doc
      .moveDown(0.3)
      .font("Helvetica")
      .fontSize(12)
      .fillColor(CORPO)
      .text(dados.periodo.label, { align: "center" });

    const hoje = new Date().toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "America/Sao_Paulo",
    });
    doc
      .moveDown(0.2)
      .fontSize(9)
      .fillColor(CORPO)
      .text(`Documento gerado em ${hoje} por ${registro.geradoPorNome}`, { align: "center" });

    // Texto-resumo (determinístico — dos próprios números)
    const resumo =
      `No período (${dados.periodo.label.toLowerCase()}), o Instituto acolheu ` +
      `${dados.novas.familias} ${dados.novas.familias === 1 ? "nova família" : "novas famílias"} ` +
      `e realizou ${dados.realizados.atendimentos} ` +
      `${dados.realizados.atendimentos === 1 ? "atendimento" : "atendimentos"}. ` +
      `A base atual soma ${dados.base.familiasAtendidas} famílias atendidas ` +
      `(${dados.base.pessoasImpactadas} pessoas), das quais ${dados.base.cross2maisPct}% ` +
      `são acompanhadas por duas ou mais unidades.`;
    doc
      .moveDown(1.4)
      .font("Helvetica")
      .fontSize(11.5)
      .fillColor(CORPO)
      .text(resumo, M, doc.y, { width: W - M * 2, align: "justify", lineGap: 3 });

    // ----- Tabela de números -----
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

    if (registro.tipo === TipoRelatorio.IMPACTO) {
      // Relatório de Impacto: foco no acumulado e no diferencial (cross-unidade)
      secao("Impacto institucional (acumulado)");
      linha("Famílias atendidas", n(dados.base.familiasAtendidas), true);
      linha("Pessoas impactadas", n(dados.base.pessoasImpactadas), true);
      linha(
        "Famílias em 2+ unidades",
        `${n(dados.base.cross2mais)} (${dados.base.cross2maisPct}%)`,
        true,
      );
      secao("Movimento do período");
      linha("Novas famílias acolhidas", n(dados.novas.familias));
      linha("Atendimentos realizados", n(dados.realizados.atendimentos));
      linha("Certificados emitidos", n(dados.realizados.certificados));
      linha("Graduações concedidas", n(dados.realizados.graduacoes));
    } else {
      // Prestação de Contas: números do período + base atual
      secao("Números do período");
      linha("Famílias acolhidas", n(dados.novas.familias));
      linha("Novas matrículas", n(dados.novas.matriculas));
      linha("Atendimentos realizados", n(dados.realizados.atendimentos));
      linha("Certificados emitidos", n(dados.realizados.certificados));
      linha("Graduações concedidas", n(dados.realizados.graduacoes));
      secao("Base atual (acumulado)");
      linha("Famílias atendidas", n(dados.base.familiasAtendidas), true);
      linha("Pessoas impactadas", n(dados.base.pessoasImpactadas), true);
      linha(
        "Famílias em 2+ unidades",
        `${n(dados.base.cross2mais)} (${dados.base.cross2maisPct}%)`,
        true,
      );
    }

    // ----- Selo da Coroa (rodapé) com código + hash verificáveis -----
    const seloY = H - 156;
    const seloX = W / 2;
    doc.lineWidth(1.5).strokeColor(DOURADO).circle(seloX, seloY, 30).stroke();
    doc.lineWidth(0.6).strokeColor(DOURADO).circle(seloX, seloY, 24).stroke();
    doc
      .font("Helvetica-Bold")
      .fontSize(14)
      .fillColor(TINTA)
      .text("IFP", seloX - 30, seloY - 7, { width: 60, align: "center" });
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(TINTA)
      .text(`Código: ${registro.codigo}`, M, seloY + 44, { width: W - M * 2, align: "center" });
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(CORPO)
      .text(`Selo de autenticidade: ${registro.hash}`, M, seloY + 58, {
        width: W - M * 2,
        align: "center",
      });
    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(CORPO)
      .text(
        "Documento gerado pelo IFP Connect a partir dos dados operacionais do Instituto.",
        M,
        seloY + 74,
        { width: W - M * 2, align: "center" },
      );

    doc.end();
    return fim;
  }

  /** Código curto legível e único (ex.: "IFP-7K3QA9"). */
  private gerarCodigo(): string {
    const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O/1/I
    const bytes = randomBytes(6);
    let sufixo = "";
    for (const b of bytes) sufixo += alfabeto[b % alfabeto.length];
    return `IFP-${sufixo}`;
  }
}
