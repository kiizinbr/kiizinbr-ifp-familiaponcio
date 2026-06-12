import type { Metadata } from "next";
import { Jost } from "next/font/google";
import "./globals.css";

// Jost = substituta geométrica da Garet (direção CASA), SÓ para display/headings:
// expõe --font-jost, consumida por --ifp-font-display (casa-tokens.css) e pela
// classe `font-display` (ponte @theme do globals.css). O corpo do app segue
// Hanken Grotesk (--font-ui) — nada muda nas telas existentes.
const jost = Jost({
  subsets: ["latin"],
  variable: "--font-jost",
  display: "swap",
});

export const metadata: Metadata = {
  title: "IFP Connect",
  description: "Plataforma do Instituto Família Pôncio",
};

// O app SEMPRE inicia no tema claro (dark é secundário, opt-in pelo toggle).
// Por isso NÃO restauramos preferência salva no boot — abrir/recarregar volta
// pro claro. Como nada muta data-theme antes da hidratação, não há mismatch.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="light" className={jost.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
