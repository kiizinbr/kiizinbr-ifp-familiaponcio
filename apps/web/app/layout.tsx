import type { Metadata, Viewport } from "next";
import { Jost } from "next/font/google";
import { getServerSession } from "next-auth";
import "./globals.css";
import { authOptions } from "@/lib/auth";
import { Providers } from "./providers";
import { CasaDefs } from "@/components/casa";

// Jost = substituta geométrica da Garet (direção CASA do protótipo Connect).
// Quando o Erick enviar os .woff2 da Garet oficial, trocar por next/font/local.
const jost = Jost({
  subsets: ["latin"],
  variable: "--ifp-font-fallback",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "IFP Connect — Instituto Família Poncio",
    template: "%s · IFP Connect",
  },
  description:
    "Plataforma do Instituto Família Poncio — saúde, capacitação, esporte e educação infantil.",
  applicationName: "IFP Connect",
  authors: [{ name: "Instituto Família Poncio" }],
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#FF772E",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  return (
    <html lang="pt-BR" className={jost.variable} suppressHydrationWarning>
      <body>
        <CasaDefs />
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
