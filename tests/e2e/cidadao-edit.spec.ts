import { test, expect, type Page } from "@playwright/test";

/**
 * e2e da edição de Ficha (melhorias Task 2) + redação de campo sensível na timeline.
 * - gestor_geral edita telefone → detalhe reflete.
 * - gestor_geral edita campo de Saúde → no histórico, recepção NÃO vê o nome do
 *   campo (redação Refinement B), gestor_geral vê.
 *
 * Pré-requisito: `pnpm db:seed`.
 */

const DEMO_PASSWORD = "ifp-demo-2026";

async function loginAs(page: Page, email: string, password: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.match(/^\/(login)?$/), { timeout: 15000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForLoadState("networkidle");
}

function gerarCpf(): string {
  const base = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  const dv = (digits: number[]): number => {
    const start = digits.length + 1;
    const soma = digits.reduce((acc, d, i) => acc + d * (start - i), 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = dv(base);
  const d2 = dv([...base, d1]);
  return [...base, d1, d2].join("");
}

test.describe.serial("Edição de Ficha + redação na timeline", () => {
  let cidadaoUrl = "";
  const nome = `Teste E2E Edit ${Date.now()}`;
  const novoTelefone = "(21) 97777-1234";

  test("recepção cria a ficha", async ({ page }) => {
    await loginAs(page, "maria.callcenter@familiaponcio.org.br", DEMO_PASSWORD);
    await page.goto("/app/cidadaos/novo");
    await page.getByLabel(/Nome completo/).fill(nome);
    await page.getByLabel(/^CPF/).fill(gerarCpf());
    await page.getByLabel(/Data de nascimento/).fill("1988-07-15");
    await page.getByRole("button", { name: /Contato/ }).click();
    await page.getByLabel(/Telefone principal/).fill("(21) 90000-0000");
    await page.getByRole("button", { name: /Salvar Ficha/ }).click();
    await page.waitForURL(
      (url) => /\/app\/cidadaos\/[^/]+$/.test(url.pathname) && !url.pathname.endsWith("/novo"),
      { timeout: 15000 },
    );
    cidadaoUrl = page.url();
  });

  test("gestor_geral edita o telefone e o detalhe reflete", async ({ page }) => {
    await loginAs(page, "raquel.barros@familiaponcio.org.br", DEMO_PASSWORD);
    await page.goto(`${cidadaoUrl}/editar`);
    await page.getByRole("button", { name: /Contato/ }).click();
    await page.getByLabel(/Telefone principal/).fill(novoTelefone);
    await page.getByRole("button", { name: /Salvar alterações/ }).click();

    await page.waitForURL((url) => url.pathname.endsWith(new URL(cidadaoUrl).pathname), {
      timeout: 15000,
    });
    await expect(page.getByText(novoTelefone)).toBeVisible();
  });

  test("gestor_geral edita um campo de Saúde", async ({ page }) => {
    await loginAs(page, "raquel.barros@familiaponcio.org.br", DEMO_PASSWORD);
    await page.goto(`${cidadaoUrl}/editar`);
    await page.getByRole("button", { name: /Saúde/ }).click();
    await page.getByLabel(/Alergias/).fill("Dipirona");
    await page.getByRole("button", { name: /Salvar alterações/ }).click();
    await page.waitForURL((url) => url.pathname.endsWith(new URL(cidadaoUrl).pathname), {
      timeout: 15000,
    });
  });

  test("histórico: gestor_geral VÊ o campo de saúde alterado", async ({ page }) => {
    await loginAs(page, "raquel.barros@familiaponcio.org.br", DEMO_PASSWORD);
    await page.goto(`${cidadaoUrl}/historico`);
    await expect(page.getByText("Ficha atualizada").first()).toBeVisible();
    await expect(page.getByText(/Alergias/).first()).toBeVisible();
  });

  test("histórico: recepção NÃO vê o nome do campo de saúde (redação)", async ({ page }) => {
    await loginAs(page, "maria.callcenter@familiaponcio.org.br", DEMO_PASSWORD);
    await page.goto(`${cidadaoUrl}/historico`);
    await expect(page.getByText("Ficha atualizada").first()).toBeVisible();
    await expect(page.getByText(/alergia/i)).toHaveCount(0);
  });
});
