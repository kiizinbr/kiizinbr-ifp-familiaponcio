import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import type { Certificado } from "@prisma/client";
import { IfpPdfHeader, IfpPdfFooter } from "@/lib/pdf/chrome";
import { PDF_TINTA, PDF_TEAL, PDF_LARANJA, PDF_CINZA } from "@/lib/pdf/styles";

/** Data do certificado formatada em pt-BR (ex.: "5 de junho de 2026"). */
const fmtData = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const s = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 48,
    fontFamily: "Helvetica",
    color: PDF_TINTA,
  },
  corpo: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
  },
  titulo: {
    fontSize: 40,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 6,
    color: PDF_TEAL,
    marginBottom: 4,
  },
  subtitulo: {
    fontSize: 11,
    letterSpacing: 2,
    color: PDF_CINZA,
    marginBottom: 28,
  },
  certificaQue: { fontSize: 12, color: PDF_CINZA, marginBottom: 10 },
  aluno: {
    fontSize: 30,
    fontFamily: "Helvetica-Bold",
    color: PDF_TINTA,
    marginBottom: 6,
  },
  regua: {
    width: 220,
    borderBottomWidth: 2,
    borderColor: PDF_LARANJA,
    marginBottom: 20,
  },
  frase: {
    fontSize: 14,
    lineHeight: 1.6,
    color: PDF_TINTA,
    maxWidth: 560,
    marginBottom: 24,
  },
  curso: { fontFamily: "Helvetica-Bold", color: PDF_TEAL },
  destaque: { fontFamily: "Helvetica-Bold" },
  data: { fontSize: 12, color: PDF_CINZA },
  verificacao: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 12,
  },
  qr: { width: 76, height: 76 },
  verificacaoTexto: { fontSize: 9, color: PDF_CINZA, maxWidth: 320, textAlign: "left" },
  verificacaoUrl: { fontFamily: "Helvetica-Bold", color: PDF_TINTA },
  codigo: { fontFamily: "Helvetica-Bold", color: PDF_TEAL },
});

interface CertificadoPdfProps {
  /** Snapshot do certificado (model Prisma). */
  cert: Pick<
    Certificado,
    "codigo" | "nomeAluno" | "nomeCurso" | "cargaHoraria" | "percentualFrequencia" | "emitidoEm"
  >;
  /** URL pública de verificação (alvo do QR). */
  verificacaoUrl: string;
  /** QR como data URL (PNG) — vindo de qrDataUrl(). */
  qr: string;
}

/**
 * Diploma de conclusão (vertical Capacitação). A4 paisagem, marca IFP, com QR de
 * verificação pública. Componente puro — recebe o snapshot já carregado e o QR
 * pronto; não acessa banco nem rede.
 */
export function CertificadoPdf({
  cert,
  verificacaoUrl,
  qr,
}: CertificadoPdfProps): ReactElement<DocumentProps> {
  const dataFormatada = fmtData.format(cert.emitidoEm);

  return (
    <Document
      title={`Certificado ${cert.codigo}`}
      author="Instituto Família Pôncio"
      subject={`Certificado de conclusão — ${cert.nomeCurso}`}
    >
      <Page size="A4" orientation="landscape" style={s.page}>
        <IfpPdfHeader unidade="Capacitação" />

        <View style={s.corpo}>
          <Text style={s.titulo}>CERTIFICADO</Text>
          <Text style={s.subtitulo}>DE CONCLUSÃO</Text>

          <Text style={s.certificaQue}>O Instituto Família Pôncio certifica que</Text>
          <Text style={s.aluno}>{cert.nomeAluno}</Text>
          <View style={s.regua} />

          <Text style={s.frase}>
            concluiu o curso <Text style={s.curso}>{cert.nomeCurso}</Text> (
            <Text style={s.destaque}>{cert.cargaHoraria}h</Text>) com frequência de{" "}
            <Text style={s.destaque}>{cert.percentualFrequencia}%</Text>.
          </Text>

          <Text style={s.data}>Emitido em {dataFormatada}</Text>

          <View style={s.verificacao}>
            <Image src={qr} style={s.qr} />
            <Text style={s.verificacaoTexto}>
              Verifique em <Text style={s.verificacaoUrl}>{verificacaoUrl}</Text> — código{" "}
              <Text style={s.codigo}>{cert.codigo}</Text>
            </Text>
          </View>
        </View>

        <IfpPdfFooter nota={`Código de verificação: ${cert.codigo}`} />
      </Page>
    </Document>
  );
}
