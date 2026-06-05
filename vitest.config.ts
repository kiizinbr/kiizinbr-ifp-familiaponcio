import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/unit/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**", ".next/**"],
    // Carrega .env.local pra testes de integração que tocam o banco.
    // No-op em CI (DATABASE_URL já vem do workflow env). Ver tests/setup-env.ts.
    setupFiles: ["./tests/setup-env.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "text", "lcov"],
      include: ["src/lib/**"],
      // Ratchet de cobertura: baseline medido em 2026-06-05 (~58% linhas em
      // src/lib). Sobe rumo aos 80% da regra ECC conforme Bloco B/D adicionam
      // testes (minio/cep/cidadao-schema/auth/server-actions). Só roda com
      // `pnpm test:cov` ou --coverage — o `pnpm test` normal segue sem gate.
      thresholds: {
        lines: 55,
        functions: 58,
        branches: 44,
        statements: 54,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
