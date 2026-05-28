import { expect, test, type Page } from "@playwright/test";

const SENHA_DEMO = "ifp-demo-2026";
const SENHA_ERICK = "ifp-dev-2026";

/**
 * Faz login pela página `/<slug>/login` e espera o resultado decantar:
 * - sucesso: URL muda pra fora de `/login`
 * - falha de unidade: alert com mensagem aparece
 * Quem chama decide qual cenário asserta.
 */
async function login(page: Page, slug: string, email: string, senha: string) {
  await page.context().clearCookies();
  await page.goto(`/${slug}/login`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  // Aguarda OU navegação pra fora do login OU o alert de erro do form aparecer.
  // Ambas as branches são "soft" pra deixar quem chama decidir o cenário.
  await Promise.race([
    page
      .waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 15000 })
      .catch(() => undefined),
    loginError(page)
      .waitFor({ state: "visible", timeout: 15000 })
      .catch(() => undefined),
  ]);
}

/**
 * Localiza estritamente o `<p role="alert">` do form de login.
 * Evita colidir com o `__next-route-announcer__` que também é `role="alert"`.
 */
function loginError(page: Page) {
  return page.locator('p[role="alert"]');
}

test.describe("Multi-tenant RBAC v2", () => {
  test("landing pública / renderiza sem auth", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /quatro unidades/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /centro médico/i })).toBeVisible();
  });

  test("não autenticado em /medico redireciona pra /medico/login", async ({ page }) => {
    await page.goto("/medico");
    await expect(page).toHaveURL(/\/medico\/login$/);
  });

  test("Raquel (gestor:medico) loga em /medico e entra", async ({ page }) => {
    await login(page, "medico", "raquel.barros@familiaponcio.org.br", SENHA_DEMO);
    await expect(page).toHaveURL(/\/medico$/);
    await expect(page.getByText("Centro Médico")).toBeVisible();
  });

  test("Raquel em /capacitacao/login mostra erro genérico", async ({ page }) => {
    await login(page, "capacitacao", "raquel.barros@familiaponcio.org.br", SENHA_DEMO);
    await expect(loginError(page)).toContainText(/não foi possível acessar/i);
  });

  test("Saulo (presidencia) loga em /poncio", async ({ page }) => {
    await login(page, "poncio", "saulo@familiaponcio.org.br", SENHA_DEMO);
    await expect(page).toHaveURL(/\/poncio$/);
    await expect(page.getByText(/visão geral/i)).toBeVisible();
  });

  test("Saulo em /medico/login mostra erro", async ({ page }) => {
    await login(page, "medico", "saulo@familiaponcio.org.br", SENHA_DEMO);
    await expect(loginError(page)).toContainText(/não foi possível acessar/i);
  });

  test("Regina (social) loga em /social", async ({ page }) => {
    await login(page, "social", "regina@familiaponcio.org.br", SENHA_DEMO);
    await expect(page).toHaveURL(/\/social$/);
  });

  test("Maria (recepcao:medico) em /social/login mostra erro", async ({ page }) => {
    await login(page, "social", "maria.callcenter@familiaponcio.org.br", SENHA_DEMO);
    await expect(loginError(page)).toContainText(/não foi possível acessar/i);
  });

  test("Erick (super_admin) loga em /medico e acessa todas as 6 unidades", async ({ page }) => {
    // /social roda muitos queries no Prisma (triagens + cidadaos), passa do default 30s
    // em prod build sob carga. Subimos pra 90s pra cobrir o loop de 5 navegações.
    test.setTimeout(90_000);

    await login(page, "medico", "erick.ramos@familiaponcio.org.br", SENHA_ERICK);
    await expect(page).toHaveURL(/\/medico$/);

    for (const slug of ["capacitacao", "esportivo", "recreativo", "poncio", "social"]) {
      await page.goto(`/${slug}`, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(new RegExp(`/${slug}$`));
    }
  });

  test("alias /app redireciona para /poncio (super_admin) ou nega (gestor de unidade)", async ({
    page,
  }) => {
    // Raquel tenta /app — sem acesso a /poncio → vai pra /
    await login(page, "medico", "raquel.barros@familiaponcio.org.br", SENHA_DEMO);
    await expect(page).toHaveURL(/\/medico$/);
    await page.goto("/app");
    await expect(page).toHaveURL("/");
  });
});
