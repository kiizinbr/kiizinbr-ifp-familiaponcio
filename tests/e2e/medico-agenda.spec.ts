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
    // KPI estável da fila do dia (label real: "Na fila"; antes era "Em fila hoje").
    await expect(page.getByText("Na fila")).toBeVisible();
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
    // /i: o dev DB tem cidadãos migrados em CAIXA ALTA ("ADRIANA ASSIS DE ALMEIDA"),
    // que ordenam antes do seed "Maria das Graças Almeida" no top-8 — case-insensitive
    // casa os dois e mantém o teste estável seja qual for o estado do banco.
    await page
      .getByRole("link", { name: /Almeida/i })
      .first()
      .click();

    // Passo 2: especialidade — Clínico Geral (1ª especialidade do Dr. João no seed)
    await page.getByRole("link", { name: /Clínico Geral/ }).click();

    // Passo 3: cria um encaixe (slot ad-hoc) em vez de depender de horários
    // pré-gerados. Robusto a qualquer estado do banco: o dev DB tem dados migrados
    // do Amplimed e "Clínico Geral" pode ficar sem slots pré-gerados, mas tem
    // profissional (Dr. João), então o formulário de encaixe está sempre disponível.
    // Datetime ÚNICO por run (amanhã no horário corrente, minuto a minuto) — evita
    // colisão "slot_existe" com slots ad-hoc de runs anteriores (o teardown não os limpa).
    const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const quando =
      `${amanha.getFullYear()}-${pad(amanha.getMonth() + 1)}-${pad(amanha.getDate())}` +
      `T${pad(amanha.getHours())}:${pad(amanha.getMinutes())}`;
    await page.locator('input[name="dataHoraInicio"]').fill(quando);
    await page.getByRole("button", { name: "Criar horário e marcar" }).click();

    // Passo 4: cai no detalhe da consulta — a faixa do paciente mostra o nome do
    // cidadão escolhido (a tela não tem um label literal "Paciente"; o nome no
    // banner é o sinal estável de que chegamos ao detalhe certo).
    await expect(page).toHaveURL(/\/medico\/consultas\/[a-z0-9]+(\?.*)?$/);
    await expect(page.getByText(/Almeida/i).first()).toBeVisible();
  });

  test("Profissional NÃO-médico (recepção) cai no estado vazio de Minha agenda", async ({
    page,
  }) => {
    await login(page, "medico", "maria.callcenter@familiaponcio.org.br", SENHA_DEMO);
    await page.goto("/medico/minha-agenda");
    await expect(page.getByText("Você não tem agenda própria")).toBeVisible();
  });
});
