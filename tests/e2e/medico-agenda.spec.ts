import { expect, test, type Page } from "@playwright/test";

const SENHA_DEMO = "ifp-demo-2026";
const SENHA_ERICK = "ifp-dev-2026";

/**
 * Login via /<slug>/login espelhando o helper do rbac-v2 spec.
 * Aguarda navegação pra fora de /login OU alert de erro.
 */
async function login(page: Page, slug: string, email: string, senha: string) {
  await page.context().clearCookies();
  await page.goto(`/${slug}/login`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page
    .waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 15000 })
    .catch(() => undefined);
}

test.describe("F1.B.1 Centro Médico — Agenda + Fila", () => {
  test("não autenticado em /medico redireciona pra login", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/medico");
    await expect(page).toHaveURL(/\/medico\/login$/);
  });

  test("Erick (super_admin) vê a Fila do dia", async ({ page }) => {
    await login(page, "medico", "erick.ramos@familiaponcio.org.br", SENHA_ERICK);
    await expect(page).toHaveURL(/\/medico$/);
    await expect(page.getByRole("heading", { name: "Fila do dia" })).toBeVisible();
    await expect(page.getByText("Em fila hoje")).toBeVisible();
  });

  test("Dr. João (profissional) acessa Minha agenda com self-service", async ({ page }) => {
    await login(page, "medico", "dr.joao@familiaponcio.org.br", SENHA_DEMO);
    await page.goto("/medico/minha-agenda");
    await expect(page.getByRole("heading", { name: "Minha agenda" })).toBeVisible();
    // Profissional de verdade vê o formulário de novo template
    await expect(page.getByText("Novo template")).toBeVisible();
  });

  test("Erick gerencia o catálogo de especialidades", async ({ page }) => {
    await login(page, "medico", "erick.ramos@familiaponcio.org.br", SENHA_ERICK);
    await page.goto("/medico/especialidades");
    await expect(page.getByRole("heading", { name: "Especialidades" })).toBeVisible();
    // Especialidade seedada aparece no catálogo
    await expect(page.getByText("Clínico Geral").first()).toBeVisible();
    // Form de criação presente
    await expect(page.getByPlaceholder("Ex: Cardiologia")).toBeVisible();
  });

  test("Recepção marca consulta no wizard de 4 passos até o detalhe", async ({ page }) => {
    test.setTimeout(60_000);
    await login(page, "medico", "maria.callcenter@familiaponcio.org.br", SENHA_DEMO);
    await page.goto("/medico/consultas/nova");

    // Passo 1: buscar cidadão
    await page.getByPlaceholder(/Buscar por nome/).fill("Almeida");
    await page.getByRole("button", { name: "Buscar" }).click();
    await page
      .getByRole("link", { name: /Almeida/ })
      .first()
      .click();

    // Passo 2: especialidade — "Clínico Geral" tem slots (1ª especialidade do Dr. João no seed)
    await page.getByRole("link", { name: /Clínico Geral/ }).click();

    // Passo 3: reservar o primeiro slot disponível (botões submit no main)
    await page.locator('main button[type="submit"]').first().click();

    // Passo 4: cai no detalhe da consulta
    await expect(page).toHaveURL(/\/medico\/consultas\/[a-z0-9]+$/);
    await expect(page.getByText("Paciente")).toBeVisible();
  });

  test("Profissional NÃO-médico (recepção) cai no estado vazio de Minha agenda", async ({
    page,
  }) => {
    await login(page, "medico", "maria.callcenter@familiaponcio.org.br", SENHA_DEMO);
    await page.goto("/medico/minha-agenda");
    await expect(page.getByText("Você não tem agenda própria")).toBeVisible();
  });
});
