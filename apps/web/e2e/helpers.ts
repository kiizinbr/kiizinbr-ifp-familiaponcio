import { expect, type Page } from "@playwright/test";

export const SENHA = process.env.SEED_MEDICO_PASSWORD ?? "";

/** Login real pela tela, aterrissando na área pedida. */
export async function login(page: Page, email: string, destino: string) {
  await page.goto(`/login?callbackUrl=${encodeURIComponent(destino)}`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(SENHA);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(`**${destino}`);
  await expect(page).toHaveURL(new RegExp(destino.replace(/\//g, "\\/")));
}
