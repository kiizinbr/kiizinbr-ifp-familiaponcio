import { test, expect } from "@playwright/test";

test("login flow funciona com erick.ramos", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login/);

  await page.fill('input[name="email"]', "erick.ramos@familiaponcio.org.br");
  await page.fill('input[name="password"]', "ifp-dev-2026");
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL(/\/app/);
  await expect(page.locator("h1")).toContainText("Erick Ramos");
});
