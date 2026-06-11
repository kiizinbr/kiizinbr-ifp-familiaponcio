import type { Metadata } from "next";
import { Jost } from "next/font/google";
import "./globals.css";

export const metadata: Metadata = {
  title: "IFP Connect",
  description: "Plataforma do Instituto Família Pôncio",
};

// Fonte Jost (substituta geométrica da Garet, direção CASA). next/font self-hospeda
// no build — sem @import remoto (mantém a regra da main). Só é carregada/aplicada
// quando a pele CASA está ligada (className condicional abaixo).
const jost = Jost({
  subsets: ["latin"],
  variable: "--font-jost",
  display: "swap",
  preload: false,
});

// Pele opt-in via env: NEXT_PUBLIC_SKIN=casa liga a direção Editorial CASA.
// Sem a flag, data-skin fica ausente e o app é byte-a-byte a main atual.
const skin = process.env.NEXT_PUBLIC_SKIN === "casa" ? "casa" : undefined;

// O app SEMPRE inicia no tema claro (dark é secundário, opt-in pelo toggle).
// Por isso NÃO restauramos preferência salva no boot — abrir/recarregar volta
// pro claro. Como nada muta data-theme antes da hidratação, não há mismatch.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      data-theme="light"
      data-skin={skin}
      className={skin === "casa" ? jost.variable : undefined}
    >
      <body className="antialiased">{children}</body>
    </html>
  );
}
