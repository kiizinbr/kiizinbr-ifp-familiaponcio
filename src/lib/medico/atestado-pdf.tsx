import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { IfpPdfHeader, IfpPdfFooter } from "@/lib/pdf/chrome";
import { renderPdf } from "@/lib/pdf/render";
import { PDF_TINTA, PDF_TEAL, PDF_CINZA, PDF_LINHA } from "@/lib/pdf/styles";

/** Dados (já snapshotados) necessários para renderizar o atestado. */
export interface AtestadoPdfData {
  nomePaciente: string;
  nomeProfissional: string;
  conselho: string;
  nroConselho: string;
  diasAfastamento?: number | null;
  cid?: string | null;
  observacao?: string | null;
  emitidoEm: Date;
}

const s = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingHorizontal: 48,
    paddingBottom: 56,
    fontSize: 11,
    fontFamily: "Helvetica",
    color: PDF_TINTA,
    lineHeight: 1.5,
  },
  titulo: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: PDF_TINTA,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  emitidoEm: { fontSize: 9, color: PDF_CINZA, marginBottom: 18 },
  bloco: {
    borderWidth: 1,
    borderColor: PDF_LINHA,
    borderRadius: 4,
    padding: 12,
    marginBottom: 24,
  },
  label: {
    fontSize: 8,
    color: PDF_CINZA,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 2,
  },
  paciente: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  corpo: { fontSize: 12, lineHeight: 1.7, marginBottom: 16 },
  destaque: { fontFamily: "Helvetica-Bold" },
  cidLinha: { fontSize: 10, color: PDF_CINZA, marginBottom: 6 },
  cidLabel: { color: PDF_TEAL, fontFamily: "Helvetica-Bold" },
  obsTitulo: {
    fontSize: 8,
    color: PDF_CINZA,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 8,
    marginBottom: 4,
  },
  obs: { fontSize: 10 },
  assinaturaBloco: { marginTop: 64, alignItems: "center" },
  assinaturaLinha: {
    borderTopWidth: 1,
    borderTopColor: PDF_TINTA,
    width: 260,
    paddingTop: 6,
    alignItems: "center",
  },
  assinaturaNome: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  assinaturaConselho: { fontSize: 9, color: PDF_CINZA, marginTop: 2 },
});

/** Monta a frase do atestado conforme haja ou não dias de afastamento. */
function corpoAtestado(data: AtestadoPdfData): {
  antes: string;
  dias: string | null;
  depois: string;
} {
  if (data.diasAfastamento != null && data.diasAfastamento > 0) {
    const plural = data.diasAfastamento === 1 ? "dia" : "dias";
    return {
      antes: `Atesto, para os devidos fins, que o(a) paciente acima identificado(a) foi atendido(a) nesta data e necessita de `,
      dias: `${data.diasAfastamento} ${plural} de afastamento`,
      depois: ` de suas atividades a partir desta data.`,
    };
  }
  return {
    antes: `Atesto, para os devidos fins, que o(a) paciente acima identificado(a) foi atendido(a) nesta data, conforme avaliação clínica realizada.`,
    dias: null,
    depois: ``,
  };
}

/** Atestado médico em PDF A4 retrato — IFP Centro Médico. */
export function AtestadoPdf({ data }: { data: AtestadoPdfData }) {
  const verificacao = `Atestado · IFP Centro Médico`;
  const corpo = corpoAtestado(data);
  return (
    <Document title="Atestado Médico — IFP Centro Médico">
      <Page size="A4" style={s.page}>
        <IfpPdfHeader unidade="Centro Médico" />

        <Text style={s.titulo}>Atestado Médico</Text>
        <Text style={s.emitidoEm}>
          Emitido em{" "}
          {data.emitidoEm.toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" })}
        </Text>

        <View style={s.bloco}>
          <Text style={s.label}>Paciente</Text>
          <Text style={s.paciente}>{data.nomePaciente}</Text>
        </View>

        <Text style={s.corpo}>
          {corpo.antes}
          {corpo.dias ? <Text style={s.destaque}>{corpo.dias}</Text> : null}
          {corpo.depois}
        </Text>

        {data.cid ? (
          <Text style={s.cidLinha}>
            <Text style={s.cidLabel}>CID-10: </Text>
            {data.cid}
          </Text>
        ) : null}

        {data.observacao ? (
          <View>
            <Text style={s.obsTitulo}>Observações</Text>
            <Text style={s.obs}>{data.observacao}</Text>
          </View>
        ) : null}

        <View style={s.assinaturaBloco}>
          <View style={s.assinaturaLinha}>
            <Text style={s.assinaturaNome}>{data.nomeProfissional}</Text>
            <Text style={s.assinaturaConselho}>
              {data.conselho} {data.nroConselho}
            </Text>
          </View>
        </View>

        <IfpPdfFooter nota={verificacao} />
      </Page>
    </Document>
  );
}

/**
 * Renderiza o atestado para Buffer. Mantém o JSX dentro de um arquivo `.tsx`
 * para os route handlers (`route.ts`) permanecerem livres de JSX.
 */
export function renderAtestadoPdf(data: AtestadoPdfData): Promise<Buffer> {
  return renderPdf(<AtestadoPdf data={data} />);
}
