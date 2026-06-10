import { test, expect } from "@playwright/test";

import { login } from "./helpers";

/**
 * Vertical do Centro Médico, ponta a ponta pela UI:
 * login → dashboard → novo agendamento (busca sem acento) → prancha →
 * SOAP → selar → agenda mostra Concluído → prontuário em modo leitura.
 */
test("médico: do agendamento ao prontuário selado", async ({ page }) => {
  const motivo = `E2E consulta ${Date.now()}`;

  await login(page, "medico@ifp.local", "/medico");
  await expect(page.getByText("Pacientes hoje")).toBeVisible();

  // novo agendamento para HOJE 23:59 (aparece na agenda do dia)
  await page.goto("/medico/agenda");
  await page.getByRole("button", { name: "Novo agendamento" }).click();
  await page.getByPlaceholder("Ex.: Silva").fill("joao"); // unaccent na prática
  await page.getByRole("button", { name: /João da Silva/ }).click();
  const hoje = new Date();
  const quando = `${hoje.toISOString().slice(0, 10)}T23:59`;
  await page.locator("#quando").fill(quando);
  await page.locator("#motivo").fill(motivo);
  await page.getByRole("button", { name: "Agendar" }).click();

  // o card novo aparece na lista de hoje
  const card = page.getByRole("link", { name: new RegExp(motivo) });
  await expect(card).toBeVisible();
  await card.click();

  // prancha: auto-inicia; preenche S e P e sela
  await expect(page.getByText("Resumo da consulta")).toBeVisible();
  await page.getByRole("button", { name: /Queixa/ }).click();
  await page.locator("#subjetivo").fill("Dor de cabeça há 2 dias (E2E)");
  await page.getByRole("button", { name: /Conduta/ }).click();
  await page.locator("#plano").fill("Hidratação e repouso (E2E)");
  await page.getByRole("button", { name: /Selo/ }).click();
  await page.getByRole("button", { name: "Selar atendimento" }).click();

  // volta pra agenda e o atendimento está Concluído
  await page.waitForURL("**/medico/agenda");
  await expect(
    page.getByRole("link", { name: new RegExp(motivo) }).getByText("Concluído"),
  ).toBeVisible();

  // reabrir → somente leitura
  await page.getByRole("link", { name: new RegExp(motivo) }).click();
  await expect(page.getByText("modo somente leitura")).toBeVisible();
});
