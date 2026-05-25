import { test, expect, type Page } from "@playwright/test";

/**
 * e2e do Funil — Fatia A (agendamento interno).
 * coordenação cria vaga (slots=2) → callcenter agenda 2 → capacidade trava (form some)
 * → confirma um → RBAC (presidencia não acessa Vagas).
 *
 * Pré-requisito: `pnpm db:seed`. Teardown limpa "Vaga E2E"? Não — agendamentos usam
 * nomes "Interessado E2E"; cidadãos de teste já têm teardown. Vagas de teste ficam (poucas).
 */

const DEMO = "ifp-demo-2026";

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

test.describe.serial("Funil — vagas e agendamentos", () => {
  let vagaUrl = "";
  const tag = Date.now();

  test("coordenação cria uma vaga com 2 slots", async ({ page }) => {
    await loginAs(page, "raquel.barros@familiaponcio.org.br", DEMO);
    await page.goto("/app/vagas/nova");
    await page.getByLabel("Unidade").selectOption("medico");
    await page.getByLabel(/Slots/).fill("2");
    await page.getByLabel(/Título da vaga/).fill(`Vaga E2E ${tag}`);
    await page.getByRole("button", { name: /Criar vaga/ }).click();

    await page.waitForURL(
      (url) => /\/app\/vagas\/[^/]+$/.test(url.pathname) && !url.pathname.endsWith("/nova"),
      {
        timeout: 15000,
      },
    );
    await expect(page.getByRole("heading", { name: `Vaga E2E ${tag}` })).toBeVisible();
    vagaUrl = page.url();
  });

  test("callcenter agenda 2 entrevistas e a capacidade trava na 3ª", async ({ page }) => {
    await loginAs(page, "maria.callcenter@familiaponcio.org.br", DEMO);

    for (let i = 1; i <= 2; i++) {
      await page.goto(vagaUrl);
      await page.getByLabel("Nome do interessado").fill(`Interessado E2E ${tag}-${i}`);
      await page.getByLabel("Telefone", { exact: true }).fill(`2199999000${i}`);
      await page.getByLabel("Horário").fill("2026-06-01T10:00");
      await page.getByRole("button", { name: /Agendar entrevista/ }).click();
      await expect(page.getByText(`Interessado E2E ${tag}-${i}`)).toBeVisible();
    }

    // slots cheios → o formulário de novo agendamento some
    await page.goto(vagaUrl);
    await expect(page.getByRole("heading", { name: "Novo agendamento" })).toHaveCount(0);
  });

  test("callcenter confirma um agendamento", async ({ page }) => {
    await loginAs(page, "maria.callcenter@familiaponcio.org.br", DEMO);
    await page.goto(vagaUrl);
    await page.getByRole("button", { name: "Confirmar" }).first().click();
    await expect(page.getByText("confirmado").first()).toBeVisible();
  });

  test("presidência (não agenda) recebe 404 em Vagas", async ({ page }) => {
    await loginAs(page, "saulo@familiaponcio.org.br", DEMO);
    const resp = await page.goto("/app/vagas");
    expect(resp?.status()).toBe(404);
  });
});
