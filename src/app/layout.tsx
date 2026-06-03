import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "IFP Connect",
  description: "Plataforma do Instituto Família Pôncio",
};

// Aplica o tema salvo ANTES do paint (evita flash claro→escuro). data-theme
// default "light" no <html>; só promove pra "dark" se o usuário escolheu.
const THEME_INIT = `try{var t=localStorage.getItem('ifp-theme');if(t==='dark')document.documentElement.dataset.theme='dark';}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="light">
      <body className="antialiased">
        <Script id="ifp-theme-init" strategy="beforeInteractive">
          {THEME_INIT}
        </Script>
        {children}
      </body>
    </html>
  );
}
