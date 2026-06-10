import { test, expect } from "@playwright/test";

import { login } from "./helpers";

/**
 * Vertical da Capacitação, ponta a ponta pela UI:
 * login → dashboard → nova turma → matricular (busca sem acento) →
 * aula + chamada + selo → encerrar turma → certificado → verificação pública.
 */
test("capacitação: da turma ao certificado verificável", async ({ page }) => {
  const codigo = `E2E-${Date.now()}`;

  await login(page, "instrutor@ifp.local", "/capacitacao");
  await expect(page.getByText("Turmas em andamento")).toBeVisible();

  // nova turma
  await page.goto("/capacitacao/turmas");
  await page.getByRole("button", { name: "Nova turma" }).click();
  await page.locator("#cursoId").selectOption({ index: 1 });
  await page.locator("#codigo").fill(codigo);
  await page.locator("#dias").fill("Sex 8h-11h (E2E)");
  await page.getByRole("button", { name: "Criar turma" }).click();
  const cardTurma = page.getByRole("link", { name: new RegExp(codigo) });
  await expect(cardTurma).toBeVisible();
  await cardTurma.click();

  // matricular o João (busca sem acento)
  await page.getByRole("button", { name: "Matricular aluno" }).click();
  await page.getByPlaceholder(/Nome da família/).fill("joao");
  await page.getByRole("button", { name: /João da Silva/ }).click();
  await expect(page.getByText(/matriculado\(a\)!/)).toBeVisible();

  // aula de hoje → chamada (João fica PRESENTE por padrão) → salvar e selar
  await page.getByRole("button", { name: "Nova aula (hoje)" }).click();
  await page.waitForURL("**/aulas/**");
  await expect(page.getByText(`Chamada — ${codigo}`)).toBeVisible();
  await page.getByRole("button", { name: "Salvar e selar" }).click();
  await page.waitForURL(/\/capacitacao\/turmas\/[^/]+$/);

  // encerrar turma (confirma o dialog) → certificado emitido
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Encerrar turma" }).click();
  await expect(page.getByText(/1 certificado\(s\)/)).toBeVisible();
  await expect(page.getByText("Concluída")).toBeVisible();

  // badge do certificado → verificação pública + download do PDF
  await page.getByRole("link", { name: "Certificado" }).click();
  await page.waitForURL("**/verificar/**");
  await expect(page.getByText("Certificado autêntico")).toBeVisible();
  await expect(page.getByText("João da Silva")).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Baixar certificado \(PDF\)/ }),
  ).toBeVisible();
});
