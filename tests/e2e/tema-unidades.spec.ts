import { test, expect } from "@playwright/test";

/**
 * Cobertura do GAP DOS 6 TEMAS: cada `/<unit>/login` (porta PÚBLICA, sem login)
 * deve carregar o CONTRATO DE TEMA da sua unidade.
 *
 * Verdade do app (lida do código, não do pixel):
 * - `src/components/unidade-login-shell.tsx` renderiza o root como
 *   `<main className="ifp-kit …" data-unit={unidade.slug} data-unit-accent="">`.
 *   → hook estável de TEMA = atributo `data-unit="<slug>"` (+ `data-unit-accent`)
 *     no único `<main>` da porta de login. É exatamente o contrato declarado em
 *     CLAUDE.md ("data-unit=… por segmento de unidade"), por onde os tokens
 *     re-resolvem o acento. NÃO comparamos cor — só a presença do contrato.
 * - O `<h1>` do painel (`styles.title`) é `unidade.nome`.
 *   → hook estável de IDENTIDADE visível = heading nível 1 com o nome da unidade.
 *
 * Read-only: só a porta pública, nenhum login.
 */

// Espelha `UNIDADES` em src/lib/unidades.ts (slug → nome canônico do Brandbook).
const UNIDADES = [
  { slug: "medico", nome: "Centro Médico" },
  { slug: "capacitacao", nome: "Capacitação" },
  { slug: "esportivo", nome: "Esportivo" },
  { slug: "recreativo", nome: "Recreativo" },
  { slug: "poncio", nome: "Pôncio Executivo" },
  { slug: "social", nome: "Serviço Social" },
] as const;

for (const { slug, nome } of UNIDADES) {
  test(`/${slug}/login carrega o contrato de tema da unidade (${nome})`, async ({ page }) => {
    await page.context().clearCookies();
    await page.goto(`/${slug}/login`);

    // Hook de TEMA: o root <main> da porta de login carrega o data-unit da unidade.
    // Único elemento com data-unit na página pública → seletor não-ambíguo.
    const root = page.locator("main[data-unit]");
    await expect(root).toHaveAttribute("data-unit", slug);
    // Contrato completo: o flag de acento forte também está presente.
    await expect(root).toHaveAttribute("data-unit-accent", "");

    // Hook de IDENTIDADE: o título da porta é o nome canônico da unidade.
    await expect(page.getByRole("heading", { level: 1, name: nome })).toBeVisible();
  });
}
