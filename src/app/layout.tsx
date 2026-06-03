import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IFP Connect",
  description: "Plataforma do Instituto Família Pôncio",
};

// O app SEMPRE inicia no tema claro (dark é secundário, opt-in pelo toggle).
// Por isso NÃO restauramos preferência salva no boot — abrir/recarregar volta
// pro claro. Como nada muta data-theme antes da hidratação, não há mismatch.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="light">
      <body className="antialiased">{children}</body>
    </html>
  );
}
