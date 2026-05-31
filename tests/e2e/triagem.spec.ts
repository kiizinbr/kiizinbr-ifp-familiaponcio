import { test, expect } from "@playwright/test";
import { login, SENHA_DEMO } from "./helpers/login";

/**
 * Testes e2e do Plano 4 — Núcleo de Triagem (fatia estrutural).
 * Fluxo: recepção cria cidadão → assistente social (Regina) abre triagem,
 * registra entrevista, conclui, e decide elegibilidade por unidade.
 *
 * Nota: a transição statusCadastro rascunho→ativo NÃO é testada via UI porque
 * o cadastro nasce 'ativo' por default (criação de rascunho é fatia futura).
 * A regra `deveAtivarCidadao` tem cobertura unitária.
 *
 * Login é per-unidade (RBAC v2): Maria (recepcao:medico) entra pela unidade
 * `medico`; Regina (social) entra pela unidade `social`. Os corpos seguem
 * navegando pelas rotas legadas `/app/cidadaos/*` (inalteradas via proxy).
 *
 * Pré-requisito: `pnpm db:seed` (9 users seedados).
 */

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

test.describe.serial("Triagem social (Plano 4)", () => {
  let cidadaoUrl = "";
  const nome = `Triagem E2E ${Date.now()}`;

  test("recepção cria um cidadão para triar", async ({ page }) => {
    await login(page, "medico", "maria.callcenter@familiaponcio.org.br", SENHA_DEMO);
    await page.goto("/app/cidadaos/novo");
    await page.getByLabel(/Nome completo/).fill(nome);
    await page.getByLabel(/^CPF/).fill(gerarCpf());
    await page.getByLabel(/Data de nascimento/).fill("1992-03-10");
    await page.getByRole("button", { name: /Contato/ }).click();
    await page.getByLabel(/Telefone principal/).fill("(21) 98888-0000");
    await page.getByRole("button", { name: /Salvar Ficha/ }).click();

    await page.waitForURL(
      (url) => /\/app\/cidadaos\/[^/]+$/.test(url.pathname) && !url.pathname.endsWith("/novo"),
      { timeout: 15000 },
    );
    cidadaoUrl = page.url();
  });

  test("assistente social abre a triagem, preenche a entrevista e conclui", async ({ page }) => {
    await login(page, "social", "regina@familiaponcio.org.br", SENHA_DEMO);
    await page.goto(`${cidadaoUrl}/triagem`);

    await page.getByRole("button", { name: /Abrir triagem/ }).click();
    await expect(page.getByRole("heading", { name: "Entrevista" })).toBeVisible();

    await page.getByLabel(/Parecer/).fill("Família em situação de vulnerabilidade.");
    await page.getByRole("button", { name: /Salvar entrevista/ }).click();
    await expect(page.getByText("Entrevista salva.")).toBeVisible();

    await page.getByRole("button", { name: /Concluir triagem/ }).click();
    await expect(page.getByText("Concluída")).toBeVisible();
  });

  test("aprova elegibilidade no Centro Médico e a decisão persiste", async ({ page }) => {
    await login(page, "social", "regina@familiaponcio.org.br", SENHA_DEMO);
    await page.goto(`${cidadaoUrl}/triagem`);

    const row = page.getByTestId("eleg-row-medico");
    await row.getByLabel("Status Centro Médico").selectOption("aprovado");
    await row.getByRole("button", { name: "Salvar" }).click();

    // Após o refresh, a decisão persiste como aprovado.
    await expect(page.getByTestId("eleg-row-medico")).toContainText("aprovado");
  });

  test("histórico do cidadão mostra os eventos de triagem", async ({ page }) => {
    await login(page, "social", "regina@familiaponcio.org.br", SENHA_DEMO);
    await page.goto(`${cidadaoUrl}/historico`);

    await expect(page.getByText("Triagem aberta")).toBeVisible();
    await expect(page.getByText("Triagem concluída")).toBeVisible();
  });
});
