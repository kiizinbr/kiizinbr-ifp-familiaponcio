import type { NextConfig } from "next";
import path from "node:path";

// Cabeçalhos de segurança aplicados a todas as rotas.
// CSP entra em REPORT-ONLY (C3 do sprint de endurecimento): não bloqueia nada,
// só reporta violações no console — para inventariar o que precisa de allowlist
// (imagens externas do site, fetch de CEP em connect-src, scripts inline do Next)
// ANTES de migrar para enforce + nonce. Flip para enforce = follow-up após staging.
const cspReportOnly = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
].join("; ");

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "geolocation=(), payment=(), usb=()" },
  { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
];

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  typedRoutes: true,
  serverExternalPackages: ["@react-pdf/renderer"],
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
