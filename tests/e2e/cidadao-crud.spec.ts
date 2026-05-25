import { test, expect, type Page } from "@playwright/test";

/**
 * Testes e2e do Plano 3 — Ficha Cidadã (Task 10).
 * Cobertura: criar (recepção), buscar, RBAC de seção (Saúde/Socio),
 * acesso a unidade errada (404), e timeline de histórico (Task 9).
 *
 * Pré-requisito: `pnpm db:seed` (9 users seedados).
 * Escopo adaptado à UI existente: edição de ficha ainda não foi construída,
 * então "editar telefone" do plano original não é testável e fica pro futuro.
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

/** Gera um CPF válido (dígitos verificadores corretos) e único por execução. */
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

// Estado compartilhado entre os testes seriais (criado no primeiro, reusado depois).
test.describe.serial("Ficha Cidadã — CRUD + RBAC", () => {
  let urlCriada = "";
  const nomeCriado = `Teste E2E ${Date.now()}`;

  test("recepção cria uma ficha e é levada ao detalhe", async ({ page }) => {
    await loginAs(page, "maria.callcenter@familiaponcio.org.br", DEMO_PASSWORD);
    await page.goto("/app/cidadaos/novo");

    // Aba Identificação (ativa por padrão)
    await page.getByLabel(/Nome completo/).fill(nomeCriado);
    await page.getByLabel(/^CPF/).fill(gerarCpf());
    await page.getByLabel(/Data de nascimento/).fill("1990-05-20");

    // Aba Contato — campos persistem no state ao trocar de aba
    await page.getByRole("button", { name: /Contato/ }).click();
    await page.getByLabel(/Telefone principal/).fill("(21) 99999-0000");

    await page.getByRole("button", { name: /Salvar Ficha/ }).click();

    await page.waitForURL(
      (url) => /\/app\/cidadaos\/[^/]+$/.test(url.pathname) && !url.pathname.endsWith("/novo"),
      { timeout: 15000 },
    );
    await expect(page.locator("h1")).toContainText(nomeCriado);

    urlCriada = page.url();
  });

  test("busca encontra a ficha recém-criada pelo nome", async ({ page }) => {
    await loginAs(page, "maria.callcenter@familiaponcio.org.br", DEMO_PASSWORD);
    await page.goto(`/app/cidadaos?q=${encodeURIComponent(nomeCriado)}`);

    await expect(page.getByRole("link", { name: nomeCriado })).toBeVisible();
  });

  test("recepção NÃO vê seções Saúde e Socioeconômico no detalhe", async ({ page }) => {
    await loginAs(page, "maria.callcenter@familiaponcio.org.br", DEMO_PASSWORD);
    await page.goto(urlCriada);

    await expect(page.getByRole("heading", { name: "Saúde" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Socioeconômico" })).toHaveCount(0);
  });

  test("gestor_geral VÊ seções Saúde e Socioeconômico no detalhe", async ({ page }) => {
    await loginAs(page, "raquel.barros@familiaponcio.org.br", DEMO_PASSWORD);
    await page.goto(urlCriada);

    await expect(page.getByRole("heading", { name: "Saúde" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Socioeconômico" })).toBeVisible();
  });

  test("gestor de outra unidade recebe 404 ao acessar ficha do Centro Médico", async ({ page }) => {
    await loginAs(page, "luciana@familiaponcio.org.br", DEMO_PASSWORD);
    const resp = await page.goto(urlCriada);

    expect(resp?.status()).toBe(404);
  });

  test("histórico mostra o evento 'Ficha criada' real (não derivado)", async ({ page }) => {
    await loginAs(page, "maria.callcenter@familiaponcio.org.br", DEMO_PASSWORD);
    await page.goto(`${urlCriada}/historico`);

    await expect(page.getByRole("heading", { name: "Histórico" })).toBeVisible();
    await expect(page.getByText("Ficha criada")).toBeVisible();
    // Criada via UI → evento real, sem a marca de derivado.
    await expect(page.getByText("derivado do registro")).toHaveCount(0);
  });
});
