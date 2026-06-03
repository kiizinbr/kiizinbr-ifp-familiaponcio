import { expect, test } from "@playwright/test";
import { login, SENHA_DEMO } from "./helpers/login";

const LUCIANA = "luciana@familiaponcio.org.br";

test.describe("Capacitação — smoke (login temático + painel + turma INFO)", () => {
  test("não autenticado em /capacitacao vai pro login da unidade", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/capacitacao");
    await expect(page).toHaveURL(/\/capacitacao\/login$/);
  });

  test("Luciana (gestor capacitacao) loga e cai no painel da unidade", async ({ page }) => {
    await login(page, "capacitacao", LUCIANA, SENHA_DEMO);
    // O login da unidade redireciona pra raiz do módulo (não /app/capacitacao).
    await expect(page).toHaveURL(/\/capacitacao$/);
    await expect(page.getByRole("heading", { name: "Painel da unidade" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "PRÓXIMAS TURMAS" })).toBeVisible();
    await expect(page.getByText("Informática Básica").first()).toBeVisible();
  });

  test("Luciana abre a turma INFO e vê ocupação", async ({ page }) => {
    test.setTimeout(60_000); // o detalhe roda vários queries Prisma (matrículas + candidatos)
    await login(page, "capacitacao", LUCIANA, SENHA_DEMO);

    await page.goto("/capacitacao/turmas");
    await expect(page.getByRole("heading", { name: "Turmas", exact: true })).toBeVisible();
    await page.getByRole("link", { name: /INFO-2026-01/ }).click();

    await expect(page).toHaveURL(/\/capacitacao\/turmas\/[a-z0-9]+$/);
    await expect(
      page.getByRole("heading", { name: "Informática Básica", exact: true }),
    ).toBeVisible();
    // VagasMeter renderiza "<b>n</b> / capacidade vagas" — INFO está lotada (cap 4).
    await expect(page.getByText(/vagas/).first()).toBeVisible();
  });
});
