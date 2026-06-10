import { defineConfig } from "@playwright/test";

/**
 * E2E dos fluxos completos (médico e capacitação) contra os dev servers
 * já em execução (web :3000 + api :3333 + postgres seedado).
 * Rodar: SEED_MEDICO_PASSWORD=... npx playwright test
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  fullyParallel: false, // fluxos mexem no mesmo banco dev — sequencial é mais estável
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
