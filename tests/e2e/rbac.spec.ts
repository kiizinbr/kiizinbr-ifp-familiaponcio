import { test, expect, type Page } from "@playwright/test";

/**
 * Testes e2e do Plano 2 RBAC.
 * Cobertura: role-based landing, bypass attempts, switcher visibility.
 *
 * Pré-requisito: `pnpm db:seed` rodado (9 users seedados).
 */

const DEMO_PASSWORD = "ifp-demo-2026";
const ERICK_PASSWORD = "ifp-dev-2026";

async function loginAs(page: Page, email: string, password: string) {
  // Garante state limpo (sem cookie residual de teste anterior)
  await page.context().clearCookies();
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await Promise.all([
    // Espera URL final estabilizar fora de /login e fora de / (home redirect intermediário)
    page.waitForURL((url) => !url.pathname.match(/^\/(login)?$/), { timeout: 15000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForLoadState("networkidle");
}

test.describe("Role-based landing", () => {
  test("Erick (super_admin) cai em /app Global", async ({ page }) => {
    await loginAs(page, "erick.ramos@familiaponcio.org.br", ERICK_PASSWORD);
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.locator("h1")).toContainText(/Olá, Erick/);
  });

  test("Raquel (gestor_unidade:medico) cai em /app/medico", async ({ page }) => {
    await loginAs(page, "raquel.barros@familiaponcio.org.br", DEMO_PASSWORD);
    await expect(page).toHaveURL(/\/app\/medico$/);
  });

  test("Saulo (presidencia) cai em /app Global", async ({ page }) => {
    await loginAs(page, "saulo@familiaponcio.org.br", DEMO_PASSWORD);
    await expect(page).toHaveURL(/\/app$/);
  });

  test("Luciana (gestor_unidade:capacitacao) cai em /app/capacitacao", async ({ page }) => {
    await loginAs(page, "luciana@familiaponcio.org.br", DEMO_PASSWORD);
    await expect(page).toHaveURL(/\/app\/capacitacao$/);
    await expect(page.locator("h1")).toContainText("Centro de Capacitação");
  });

  test("Livia (gestor_unidade:esportivo) cai em /app/esportivo", async ({ page }) => {
    await loginAs(page, "livia@familiaponcio.org.br", DEMO_PASSWORD);
    await expect(page).toHaveURL(/\/app\/esportivo$/);
    await expect(page.locator("h1")).toContainText("Centro Esportivo");
  });

  test("Danielle (gestor_unidade:recreativo) cai em /app/recreativo", async ({ page }) => {
    await loginAs(page, "danielle@familiaponcio.org.br", DEMO_PASSWORD);
    await expect(page).toHaveURL(/\/app\/recreativo$/);
    await expect(page.locator("h1")).toContainText("Centro Recreativo");
  });

  test("Regina (social) cai em /app/social", async ({ page }) => {
    await loginAs(page, "regina@familiaponcio.org.br", DEMO_PASSWORD);
    await expect(page).toHaveURL(/\/app\/social$/);
    await expect(page.locator("h1")).toContainText(/Triagens/);
  });

  test("Maria (recepcao:medico) cai em /app/medico", async ({ page }) => {
    await loginAs(page, "maria.callcenter@familiaponcio.org.br", DEMO_PASSWORD);
    await expect(page).toHaveURL(/\/app\/medico$/);
    await expect(page.locator("h1")).toContainText("Centro Médico");
  });
});

test.describe("Bypass prevention (proxy gates)", () => {
  test("Maria recepcao:medico não acessa /app raiz (global)", async ({ page }) => {
    await loginAs(page, "maria.callcenter@familiaponcio.org.br", DEMO_PASSWORD);
    await page.goto("/app");
    // Proxy redireciona pra / que faz role-aware → cai em /app/medico
    await expect(page).toHaveURL(/\/app\/medico$/);
  });

  test("Maria recepcao:medico não acessa /app/esportivo", async ({ page }) => {
    await loginAs(page, "maria.callcenter@familiaponcio.org.br", DEMO_PASSWORD);
    await page.goto("/app/esportivo");
    await expect(page).toHaveURL(/\/app\/medico$/);
  });

  test("Luciana capacitacao não acessa /app/medico", async ({ page }) => {
    await loginAs(page, "luciana@familiaponcio.org.br", DEMO_PASSWORD);
    await page.goto("/app/medico");
    await expect(page).toHaveURL(/\/app\/capacitacao$/);
  });

  test("Luciana capacitacao não acessa /app/social", async ({ page }) => {
    await loginAs(page, "luciana@familiaponcio.org.br", DEMO_PASSWORD);
    await page.goto("/app/social");
    await expect(page).toHaveURL(/\/app\/capacitacao$/);
  });

  test("Regina social não acessa /app raiz", async ({ page }) => {
    await loginAs(page, "regina@familiaponcio.org.br", DEMO_PASSWORD);
    await page.goto("/app");
    await expect(page).toHaveURL(/\/app\/social$/);
  });

  test("Sem sessão tentando /app redireciona pro /login", async ({ page }) => {
    await page.goto("/app");
    await expect(page).toHaveURL(/\/login/);
  });

  test("Sem sessão tentando /app/medico redireciona pro /login", async ({ page }) => {
    await page.goto("/app/medico");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("UnitSwitcher visibility", () => {
  // Após T4 (rebaixamento da Raquel a mono-role gestor_unidade:medico), só roles globais
  // (super_admin/presidencia) veem o switcher. Erick e Saulo são os que veem.
  test("Erick (super_admin) vê switcher no header", async ({ page }) => {
    await loginAs(page, "erick.ramos@familiaponcio.org.br", ERICK_PASSWORD);
    const switcher = page.locator('[data-testid="unit-switcher"]');
    await expect(switcher).toBeVisible();
  });

  test("Luciana (mono-role) NÃO vê switcher", async ({ page }) => {
    await loginAs(page, "luciana@familiaponcio.org.br", DEMO_PASSWORD);
    const switcher = page.locator('[data-testid="unit-switcher"]');
    await expect(switcher).toHaveCount(0);
  });

  test("Raquel (gestor_unidade:medico após T4) NÃO vê switcher", async ({ page }) => {
    // Raquel agora é mono-role como Luciana — não tem switcher.
    await loginAs(page, "raquel.barros@familiaponcio.org.br", DEMO_PASSWORD);
    const switcher = page.locator('[data-testid="unit-switcher"]');
    await expect(switcher).toHaveCount(0);
  });

  test("Erick (super_admin) troca de /app pra /app/medico via switcher", async ({ page }) => {
    await loginAs(page, "erick.ramos@familiaponcio.org.br", ERICK_PASSWORD);
    await expect(page).toHaveURL(/\/app$/);

    await page.click('[data-testid="unit-switcher"]');
    await page.click('a:has-text("Centro Médico")');

    await expect(page).toHaveURL(/\/app\/medico$/);
    await expect(page.locator("h1")).toContainText("Centro Médico");
  });
});
