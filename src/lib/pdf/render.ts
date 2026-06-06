import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { ReactElement } from "react";

/**
 * Renderiza um <Document> do @react-pdf/renderer para Buffer (server-side).
 * Use em route handlers: `return new Response(buf, { headers: { "content-type": "application/pdf" } })`.
 */
export function renderPdf(doc: ReactElement<DocumentProps>): Promise<Buffer> {
  return renderToBuffer(doc);
}
