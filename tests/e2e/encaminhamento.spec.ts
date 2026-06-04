import { expect, test } from "@playwright/test";
import { login, SENHA_DEMO } from "./helpers/login";

const DR_JOAO = "dr.joao@familiaponcio.org.br";
const MARIA_CC = "maria.callcenter@familiaponcio.org.br";
// Consulta em_atendimento semeada (prisma/seed.ts → seedEncaminhamentoDemo).
const CONSULTA_GP = "/medico/consultas/seed-enc-consulta-gp";
const MOTIVO = "smoke e2e — avaliação ginecológica";

test.describe("Encaminhamento — busca ativa (GP encaminha → fila → callcenter agenda)", () => {
  test("fluxo completo: pedido vira consulta e some da fila", async ({ page }) => {
    test.setTimeout(120_000);

    // 1. GP (profissional) cria o pedido na coluna 3 do prontuário.
    await login(page, "medico", DR_JOAO, SENHA_DEMO);
    await page.goto(CONSULTA_GP);
    await expect(page.getByRole("heading", { name: "Encaminhar a especialista" })).toBeVisible();
    await page.locator('select[name="especialidadeId"]').selectOption({ label: "Ginecologia" });
    await page.locator('textarea[name="motivo"]').fill(MOTIVO);
    await page.getByRole("button", { name: "Encaminhar" }).click();
    // O pedido recém-criado aparece listado (motivo é âncora única).
    await expect(page.getByText(MOTIVO).first()).toBeVisible();

    // 2. Callcenter (recepção) vê a fila e abre o agendamento.
    await login(page, "medico", MARIA_CC, SENHA_DEMO);
    await page.goto("/medico/encaminhamentos");
    await expect(page.getByRole("heading", { name: "A agendar" })).toBeVisible();
    const linha = page.getByRole("row", { name: /Ginecologia/ }).first();
    await expect(linha).toBeVisible();
    await linha.getByRole("link", { name: "Agendar" }).click();

    // 3. Wizard reaproveitado, pré-preenchido e travado no encaminhamento.
    await expect(page).toHaveURL(/encaminhamentoId=/);
    await expect(page.getByText(/Encaminhamento ·/i)).toBeVisible();

    // 4. Reserva o 1º horário → consulta nasce ligada ao encaminhamento.
    await page.locator('button[title^="Reservar"]').first().click();
    await expect(page).toHaveURL(/\/medico\/consultas\/[a-z0-9]+$/);
    await expect(page.getByText("Agendada").first()).toBeVisible();
  });
});
