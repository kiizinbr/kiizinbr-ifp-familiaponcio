/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
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
