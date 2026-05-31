import { type Page } from "@playwright/test";

export const SENHA_DEMO = "ifp-demo-2026";
export const SENHA_ERICK = "ifp-dev-2026";

/**
 * Login pela página per-unidade `/<slug>/login` (RBAC v2).
 *
 * Espera o resultado decantar: OU navega pra fora de `/login` (sucesso),
 * OU o alert de erro do form aparece (credencial inválida / unidade negada).
 * Quem chama decide qual cenário asserta.
 *
 * Fonte única — espelha o helper que nasceu duplicado em
 * medico-agenda.spec.ts e rbac-v2-multitenant.spec.ts.
 */
export async function login(page: Page, slug: string, email: string, senha: string) {
  await page.context().clearCookies();
  await page.goto(`/${slug}/login`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  // Soft em ambas as branches pra deixar quem chama decidir o cenário.
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
 * Localiza estritamente o `<p role="alert">` do form de login
 * (evita colidir com o `__next-route-announcer__`, que também é role="alert").
 */
export function loginError(page: Page) {
  return page.locator('p[role="alert"]');
}
