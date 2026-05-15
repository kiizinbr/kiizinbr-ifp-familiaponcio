import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Produz uma versão "standalone" pronta para container minimalista.
  output: "standalone",
  // Em monorepo (pnpm workspaces), o tracing precisa enxergar a raiz para
  // incluir os pacotes internos no bundle do standalone.
  outputFileTracingRoot: path.join(__dirname, "../../"),
  experimental: {
    // Permite importar @ifp/database (Prisma Client) e demais workspaces.
    serverComponentsExternalPackages: ["@prisma/client", "bcrypt"],
  },
  transpilePackages: ["@ifp/ui", "@ifp/design-tokens"],
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
