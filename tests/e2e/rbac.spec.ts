import { test, expect, type Page } from "@playwright/test";

/**
 * Testes e2e do Plano 2 RBAC.
 * Cobertura: role-based landing, bypass attempts, switcher visibility.
 *
 * Pré-requisito: `pnpm db:seed` rodado (9 users seedados).
 *
 * ── Esquema de rota ATUAL (verdade lida de src/, 2026-06-15) ──────────────────
 * O antigo scheme /app + /app/<unidade> foi APOSENTADO (proxy.ts: "/app raiz ->
 * /inicio", "/app/<unidade> removido"). O pós-login (login/actions.ts) cai em
 * /inicio, que resolve o destino real do papel via getLandingPath (rbac.ts +
 * rbac-types.getLandingPathFor):
 *   - super_admin / presidencia   → /inicio   (hub cross-unidade)
 *   - gestor_unidade/profissional/recepcao (com unitScope) → /<unitScope>
 *                                   (ex.: /medico, /capacitacao, /esportivo, /recreativo)
 *   - social                       → /social
 *   - painel                       → /painel/<unitScope>
 * Bypass: o proxy.ts usa canAccessUnidade e MANDA quem não tem acesso pra
 * /acesso-negado (não "de volta pro próprio landing", que era o comportamento do
 * proxy /app antigo). Sem sessão numa rota de unidade → /<unidade>/login;
 * numa rota não-unidade (ex.: /inicio) → /login (lib/login-redirect.ts).
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
  test("Erick (super_admin) cai no hub /inicio", async ({ page }) => {
    await loginAs(page, "erick.ramos@familiaponcio.org.br", ERICK_PASSWORD);
    await expect(page).toHaveURL(/\/inicio$/);
    // Briefing do Plantão: h1 é a saudação ("Bom dia/Boa tarde/Boa noite, Erick.").
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Erick/);
  });

  test("Raquel (gestor_unidade:medico) cai em /medico", async ({ page }) => {
    await loginAs(page, "raquel.barros@familiaponcio.org.br", DEMO_PASSWORD);
    await expect(page).toHaveURL(/\/medico$/);
  });

  test("Saulo (presidencia) cai no hub /inicio", async ({ page }) => {
    await loginAs(page, "saulo@familiaponcio.org.br", DEMO_PASSWORD);
    await expect(page).toHaveURL(/\/inicio$/);
  });

  test("Luciana (gestor_unidade:capacitacao) cai em /capacitacao", async ({ page }) => {
    await loginAs(page, "luciana@familiaponcio.org.br", DEMO_PASSWORD);
    await expect(page).toHaveURL(/\/capacitacao$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Painel da unidade");
  });

  test("Livia (gestor_unidade:esportivo) cai em /esportivo", async ({ page }) => {
    await loginAs(page, "livia@familiaponcio.org.br", DEMO_PASSWORD);
    await expect(page).toHaveURL(/\/esportivo$/);
    // Home genérica de unidade ([unidade]/page.tsx) — h1 = unidade.nome.
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Esportivo");
  });

  test("Danielle (gestor_unidade:recreativo) cai em /recreativo", async ({ page }) => {
    await loginAs(page, "danielle@familiaponcio.org.br", DEMO_PASSWORD);
    await expect(page).toHaveURL(/\/recreativo$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Recreativo");
  });

  test("Regina (social) cai em /social", async ({ page }) => {
    await loginAs(page, "regina@familiaponcio.org.br", DEMO_PASSWORD);
    await expect(page).toHaveURL(/\/social$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Triagens/);
  });

  test("Maria (recepcao:medico) cai em /medico", async ({ page }) => {
    await loginAs(page, "maria.callcenter@familiaponcio.org.br", DEMO_PASSWORD);
    await expect(page).toHaveURL(/\/medico$/);
    // /medico (médico home) — h1 = "Fila do dia"; "Centro Médico" é o eyebrow/seção.
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Fila do dia");
  });
});

test.describe("Bypass prevention (proxy gates)", () => {
  test("Maria recepcao:medico ao tentar o hub /inicio é levada pra /medico", async ({ page }) => {
    await loginAs(page, "maria.callcenter@familiaponcio.org.br", DEMO_PASSWORD);
    // /inicio é só p/ papéis globais; a própria page resolve via getLandingPath
    // e manda papel de unidade pro seu destino real.
    await page.goto("/inicio");
    await expect(page).toHaveURL(/\/medico$/);
  });

  test("Maria recepcao:medico não acessa /esportivo", async ({ page }) => {
    await loginAs(page, "maria.callcenter@familiaponcio.org.br", DEMO_PASSWORD);
    await page.goto("/esportivo");
    // proxy.ts → canAccessUnidade falha → /acesso-negado.
    await expect(page).toHaveURL(/\/acesso-negado$/);
  });

  test("Luciana capacitacao não acessa /medico", async ({ page }) => {
    await loginAs(page, "luciana@familiaponcio.org.br", DEMO_PASSWORD);
    await page.goto("/medico");
    await expect(page).toHaveURL(/\/acesso-negado$/);
  });

  test("Luciana capacitacao não acessa /social", async ({ page }) => {
    await loginAs(page, "luciana@familiaponcio.org.br", DEMO_PASSWORD);
    await page.goto("/social");
    await expect(page).toHaveURL(/\/acesso-negado$/);
  });

  test("Regina social ao tentar o hub /inicio é levada pra /social", async ({ page }) => {
    await loginAs(page, "regina@familiaponcio.org.br", DEMO_PASSWORD);
    await page.goto("/inicio");
    await expect(page).toHaveURL(/\/social$/);
  });

  test("Sem sessão tentando /inicio redireciona pro /login", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/inicio");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("Sem sessão tentando /medico redireciona pro /medico/login", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/medico");
    // login-redirect.ts: rota de unidade sem sessão → /<unidade>/login (preserva a unidade).
    await expect(page).toHaveURL(/\/medico\/login$/);
  });
});

test.describe("UnitSwitcher visibility", () => {
  // O UnitSwitcher (app-shell.tsx + unit-switcher.tsx) só renderiza para super_admin
  // (isSuper). presidência NÃO vê o switcher (não é super_admin). Erick é o único
  // dos seeds que vê.
  test("Erick (super_admin) vê switcher no header", async ({ page }) => {
    await loginAs(page, "erick.ramos@familiaponcio.org.br", ERICK_PASSWORD);
    // O UnitSwitcher é renderizado 2× (sidebar desktop + drawer mobile); no viewport
    // padrão só o desktop é visível. filter({visible}) pega o que está na tela.
    const switcher = page.getByTestId("unit-switcher").filter({ visible: true }).first();
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

  test("Saulo (presidencia) NÃO vê switcher", async ({ page }) => {
    // Switcher é gateado por super_admin; presidência (read-only global) não o vê.
    await loginAs(page, "saulo@familiaponcio.org.br", DEMO_PASSWORD);
    const switcher = page.locator('[data-testid="unit-switcher"]');
    await expect(switcher).toHaveCount(0);
  });

  test("Erick (super_admin) troca de /inicio pra /medico via switcher", async ({ page }) => {
    await loginAs(page, "erick.ramos@familiaponcio.org.br", ERICK_PASSWORD);
    await expect(page).toHaveURL(/\/inicio$/);

    await page.getByTestId("unit-switcher").filter({ visible: true }).first().click();
    // Item do menu (role=menuitem) com o nome canônico da unidade (UNIDADES[slug].nome).
    await page.getByRole("menuitem", { name: "Centro Médico" }).click();

    await expect(page).toHaveURL(/\/medico$/);
    // /medico home — h1 "Fila do dia".
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Fila do dia");
  });
});
