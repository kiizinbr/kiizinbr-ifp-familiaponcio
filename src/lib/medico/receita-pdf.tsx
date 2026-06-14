import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { IfpPdfHeader, IfpPdfFooter } from "@/lib/pdf/chrome";
import { renderPdf } from "@/lib/pdf/render";
import { PDF_TINTA, PDF_TEAL, PDF_CINZA, PDF_LINHA } from "@/lib/pdf/styles";

/** Snapshot mínimo de um item da receita para renderização. */
export interface ReceitaItemView {
  medicamento: string;
  posologia: string;
  quantidade?: string | null;
  via?: string | null;
}

/** Dados (já snapshotados) necessários para renderizar o receituário. */
export interface ReceitaPdfData {
  nomePaciente: string;
  nomeProfissional: string;
  conselho: string;
  nroConselho: string;
  observacoes?: string | null;
  itens: ReceitaItemView[];
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
    marginBottom: 20,
  },
  label: {
    fontSize: 8,
    color: PDF_CINZA,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 2,
  },
  paciente: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  secao: {
    fontSize: 9,
    color: PDF_TEAL,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
  },
  item: {
    borderBottomWidth: 1,
    borderBottomColor: PDF_LINHA,
    paddingBottom: 10,
    marginBottom: 10,
  },
  itemLinha: { flexDirection: "row", marginBottom: 4 },
  itemNum: {
    width: 18,
    fontFamily: "Helvetica-Bold",
    color: PDF_TEAL,
  },
  itemMed: { fontSize: 12, fontFamily: "Helvetica-Bold", flex: 1 },
  itemDetalhe: { fontSize: 10, color: PDF_CINZA, marginLeft: 18 },
  obsTitulo: {
    fontSize: 8,
    color: PDF_CINZA,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 14,
    marginBottom: 4,
  },
  obs: { fontSize: 10 },
  assinaturaBloco: { marginTop: 56, alignItems: "center" },
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

function detalheItem(item: ReceitaItemView): string {
  const partes: string[] = [item.posologia];
  if (item.quantidade) partes.push(`Quantidade: ${item.quantidade}`);
  if (item.via) partes.push(`Via: ${item.via}`);
  return partes.join("  ·  ");
}

/** Receituário em PDF A4 retrato — IFP Centro Médico. */
export function ReceitaPdf({ data }: { data: ReceitaPdfData }) {
  const verificacao = `Receituário · IFP Centro Médico`;
  return (
    <Document title="Receituário — IFP Centro Médico">
      <Page size="A4" style={s.page}>
        <IfpPdfHeader unidade="Centro Médico" />

        <Text style={s.titulo}>Receituário</Text>
        <Text style={s.emitidoEm}>
          Emitido em{" "}
          {data.emitidoEm.toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" })}
        </Text>

        <View style={s.bloco}>
          <Text style={s.label}>Paciente</Text>
          <Text style={s.paciente}>{data.nomePaciente}</Text>
        </View>

        <Text style={s.secao}>Prescrição</Text>
        {data.itens.map((item, i) => (
          <View key={i} style={s.item} wrap={false}>
            <View style={s.itemLinha}>
              <Text style={s.itemNum}>{i + 1}.</Text>
              <Text style={s.itemMed}>{item.medicamento}</Text>
            </View>
            <Text style={s.itemDetalhe}>{detalheItem(item)}</Text>
          </View>
        ))}

        {data.observacoes ? (
          <View>
            <Text style={s.obsTitulo}>Observações</Text>
            <Text style={s.obs}>{data.observacoes}</Text>
          </View>
        ) : null}

        <View style={s.assinaturaBloco} wrap={false} minPresenceAhead={80}>
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
 * Renderiza o receituário para Buffer. Mantém o JSX dentro de um arquivo `.tsx`
 * para os route handlers (`route.ts`) permanecerem livres de JSX.
 */
export function renderReceitaPdf(data: ReceitaPdfData): Promise<Buffer> {
  return renderPdf(<ReceitaPdf data={data} />);
}
