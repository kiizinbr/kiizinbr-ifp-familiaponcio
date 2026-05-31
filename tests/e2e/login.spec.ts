import { test, expect } from "@playwright/test";
import { login, SENHA_ERICK } from "./helpers/login";

test("login per-unidade leva erick.ramos pra /medico", async ({ page }) => {
  await login(page, "medico", "erick.ramos@familiaponcio.org.br", SENHA_ERICK);

  // super_admin logando em /medico aterrissa em /medico (RBAC v2).
  await expect(page).toHaveURL(/\/medico$/);
});
