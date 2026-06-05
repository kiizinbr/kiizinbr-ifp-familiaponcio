import type { NextConfig } from "next";
import path from "node:path";

// Cabeçalhos de segurança aplicados a todas as rotas.
// CSP (Content-Security-Policy) fica DE FORA por ora: precisa de teste
// página-a-página por causa de fontes/imagens externas do site público
// (Google Fonts, Wix) — ver o REPORT da fundação. Os abaixo são seguros e
// não quebram features.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "geolocation=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  typedRoutes: true,
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
