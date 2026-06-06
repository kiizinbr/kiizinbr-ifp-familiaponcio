import { db } from "@/lib/db";
import { renderPdf } from "@/lib/pdf/render";
import { qrDataUrl } from "@/lib/pdf/qr";
import { normalizarCodigo } from "@/lib/capacitacao/certificado";
import { CertificadoPdf } from "@/lib/capacitacao/certificado-pdf";

/**
 * Download PÚBLICO do PDF do certificado — co-locado com a página de verificação
 * (`/verificar/*` fica fora do matcher do proxy, então não exige login; é o alvo do
 * "Baixar PDF" que um empregador/programa social usa ao escanear o QR).
 */
export async function GET(req: Request, ctx: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await ctx.params;
  const cert = await db.certificado.findUnique({
    where: { codigo: normalizarCodigo(codigo) },
  });
  if (!cert) {
    return new Response("Certificado não encontrado", { status: 404 });
  }

  const base = new URL(req.url).origin;
  const verificacaoUrl = `${base}/verificar/${cert.codigo}`;
  const qr = await qrDataUrl(verificacaoUrl);

  const buf = await renderPdf(
    <CertificadoPdf cert={cert} verificacaoUrl={verificacaoUrl} qr={qr} />,
  );

  return new Response(new Uint8Array(buf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename=certificado-${cert.codigo}.pdf`,
    },
  });
}
