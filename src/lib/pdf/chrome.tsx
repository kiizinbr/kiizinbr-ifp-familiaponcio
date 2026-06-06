import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { PDF_TEAL, PDF_CINZA, PDF_LINHA } from "./styles";

const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottomWidth: 2,
    borderColor: PDF_TEAL,
    paddingBottom: 8,
    marginBottom: 20,
  },
  brand: { fontSize: 13, fontFamily: "Helvetica-Bold", color: PDF_TEAL },
  unidade: { fontSize: 9, color: PDF_CINZA },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 48,
    right: 48,
    borderTopWidth: 1,
    borderColor: PDF_LINHA,
    paddingTop: 6,
    fontSize: 8,
    color: PDF_CINZA,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

/** Cabeçalho padrão dos documentos do IFP. */
export function IfpPdfHeader({ unidade }: { unidade: string }) {
  return (
    <View style={s.header}>
      <Text style={s.brand}>Instituto Família Pôncio</Text>
      <Text style={s.unidade}>{unidade}</Text>
    </View>
  );
}

/** Rodapé fixo (aparece em toda página). `nota` à direita (ex.: código de verificação). */
export function IfpPdfFooter({ nota }: { nota?: string }) {
  return (
    <View style={s.footer} fixed>
      <Text>Instituto Família Pôncio</Text>
      <Text>{nota ?? ""}</Text>
    </View>
  );
}
