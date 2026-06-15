import { expect, test, type Page } from "@playwright/test";

const SENHA_DEMO = "ifp-demo-2026";
const SENHA_ERICK = "ifp-dev-2026";

/**
 * Faz login pela página `/<slug>/login` e espera o resultado decantar:
 * - sucesso: URL muda pra fora de `/login`
 * - falha de unidade: alert com mensagem aparece
 * Quem chama decide qual cenário asserta.
 */
async function login(page: Page, slug: string, email: string, senha: string) {
  await page.context().clearCookies();
  await page.goto(`/${slug}/login`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  // Aguarda OU navegação pra fora do login OU o alert de erro do form aparecer.
  // Ambas as branches são "soft" pra deixar quem chama decidir o cenário.
  await Promise.race([
    page
      .waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 15000 })
      .catch(() => undefined),
    loginError(page)
      .waitFor({ state: "visible", timeout: 15000 })
      .catch(() => undefined),
  ]);
}

/**
 * Localiza estritamente o `<p role="alert">` do form de login.
 * Evita colidir com o `__next-route-announcer__` que também é `role="alert"`.
 */
function loginError(page: Page) {
  return page.locator('p[role="alert"]');
}

test.describe("Multi-tenant RBAC v2", () => {
  test("landing pública / renderiza sem auth", async ({ page }) => {
    await page.goto("/");
    // A landing institucional (src/components/site/site-content.ts) abre com o hero
    // "Mudar realidades…" e a seção #unidades titulada "Nossas unidades". Não há
    // heading "quatro unidades" (a copy é o eyebrow "Quatro frentes de cuidado",
    // um <span>, não um heading). Asseguramos o título de seção visível + o card
    // "Centro Médico" (h3, sempre visível) — o link homônimo vive no dropdown
    // "Acesso ao Sistema", que é visibility:hidden até abrir, então não serve aqui.
    await expect(page.getByRole("heading", { name: "Nossas unidades" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Centro Médico" })).toBeVisible();
  });

  test("não autenticado em /medico redireciona pra /medico/login", async ({ page }) => {
    await page.goto("/medico");
    await expect(page).toHaveURL(/\/medico\/login$/);
  });

  test("Raquel (gestor:medico) loga em /medico e entra", async ({ page }) => {
    await login(page, "medico", "raquel.barros@familiaponcio.org.br", SENHA_DEMO);
    await expect(page).toHaveURL(/\/medico$/);
    // "Centro Médico" aparece em 3+ lugares na home do médico (eyebrow do
    // MedicoHeader, sectionLabel da sidebar, rodapé) → getByText casa múltiplos
    // (strict-mode). O título da página é o h1 "Fila do dia" (MedicoHeader),
    // único e estável — prova que Raquel entrou na home da unidade médica.
    await expect(page.getByRole("heading", { name: "Fila do dia" })).toBeVisible();
  });

  test("Raquel em /capacitacao/login mostra erro genérico", async ({ page }) => {
    await login(page, "capacitacao", "raquel.barros@familiaponcio.org.br", SENHA_DEMO);
    // Acesso negado: gestora do médico não tem papel na capacitação. A mensagem é
    // a MESMA do pré-flight de senha ("E-mail ou senha incorretos.") — escolha
    // anti-enumeração deliberada do unidadeLoginAction (não vazar que a conta
    // existe nem que a senha confere). A prova de negação é continuar no /login.
    await expect(loginError(page)).toContainText("E-mail ou senha incorretos.");
    await expect(page).toHaveURL(/\/capacitacao\/login$/);
  });

  test("Saulo (presidencia) loga em /poncio", async ({ page }) => {
    await login(page, "poncio", "saulo@familiaponcio.org.br", SENHA_DEMO);
    await expect(page).toHaveURL(/\/poncio$/);
    // h1 da home executiva (src/app/poncio/page.tsx): "Visão geral das unidades".
    await expect(page.getByRole("heading", { name: /visão geral das unidades/i })).toBeVisible();
  });

  test("Saulo em /medico/login mostra erro", async ({ page }) => {
    await login(page, "medico", "saulo@familiaponcio.org.br", SENHA_DEMO);
    // Presidência loga só pelo /poncio; no /medico o acesso é negado com a mesma
    // mensagem genérica anti-enumeração. Negação provada por seguir no /login.
    await expect(loginError(page)).toContainText("E-mail ou senha incorretos.");
    await expect(page).toHaveURL(/\/medico\/login$/);
  });

  test("Regina (social) loga em /social", async ({ page }) => {
    await login(page, "social", "regina@familiaponcio.org.br", SENHA_DEMO);
    await expect(page).toHaveURL(/\/social$/);
  });

  test("Maria (recepcao:medico) em /social/login mostra erro", async ({ page }) => {
    await login(page, "social", "maria.callcenter@familiaponcio.org.br", SENHA_DEMO);
    // Recepção do médico não tem papel social → acesso negado, mesma mensagem
    // genérica anti-enumeração. Negação provada por seguir no /login.
    await expect(loginError(page)).toContainText("E-mail ou senha incorretos.");
    await expect(page).toHaveURL(/\/social\/login$/);
  });

  test("Erick (super_admin) loga em /medico e acessa todas as 6 unidades", async ({ page }) => {
    // /social roda muitos queries no Prisma (triagens + cidadaos), passa do default 30s
    // em prod build sob carga. Subimos pra 90s pra cobrir o loop de 5 navegações.
    test.setTimeout(90_000);

    await login(page, "medico", "erick.ramos@familiaponcio.org.br", SENHA_ERICK);
    await expect(page).toHaveURL(/\/medico$/);

    for (const slug of ["capacitacao", "esportivo", "recreativo", "poncio", "social"]) {
      await page.goto(`/${slug}`, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(new RegExp(`/${slug}$`));
    }
  });

  test("alias legado /app resolve pro destino do papel (gestor de unidade → sua unidade)", async ({
    page,
  }) => {
    // /app é rota legada: src/app/app/page.tsx faz redirect("/inicio"), e /inicio
    // (src/app/inicio/page.tsx) reencaminha quem não é global pro getLandingPath
    // do papel. Raquel (gestor:medico) → /medico. O destino /poncio/"nega pra /"
    // do nome antigo deixou de existir quando o /app virou alias de /inicio.
    await login(page, "medico", "raquel.barros@familiaponcio.org.br", SENHA_DEMO);
    await expect(page).toHaveURL(/\/medico$/);
    await page.goto("/app");
    await expect(page).toHaveURL(/\/medico$/);
  });
});
