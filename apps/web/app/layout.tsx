import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { getServerSession } from "next-auth";
import "./globals.css";
import { authOptions } from "@/lib/auth";
import { Providers } from "./providers";

// Fallback enquanto a fonte Garet oficial não está disponível.
// Quando o Erick enviar os arquivos .woff2, trocar por next/font/local.
const inter = Inter({
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
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <body>
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
