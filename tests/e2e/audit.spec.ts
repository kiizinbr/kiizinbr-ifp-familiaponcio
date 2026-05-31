import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import { login, loginError, SENHA_ERICK } from "./helpers/login";

// Carrega .env.local manualmente pra PrismaClient achar DATABASE_URL no runner Playwright.
// Playwright nao carrega .env automaticamente (Next.js carrega no app, mas o test runner nao).
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && m[1] && !process.env[m[1]]) {
      process.env[m[1]] = m[2]?.replace(/^["']|["']$/g, "") ?? "";
    }
  }
}

/**
 * Testes e2e do audit log (Plano 2 Task 8).
 *
 * Verifica que login bem-sucedido e malsucedido geram entry no AuditLog.
 * Usa Prisma client direto pra inspecionar o DB pos-fluxo (Playwright roda Node).
 *
 * Pre-requisito: pnpm db:seed rodado (9 users seedados).
 */

const ERICK_EMAIL = "erick.ramos@familiaponcio.org.br";

const db = new PrismaClient();

test.afterAll(async () => {
  await db.$disconnect();
});

test.describe("Audit log on auth events", () => {
  test("login bem-sucedido cria entry signin_success", async ({ page }) => {
    const before = new Date();
    await login(page, "medico", ERICK_EMAIL, SENHA_ERICK);
    // super_admin logando em /medico aterrissa em /medico (sai de /login).
    await expect(page).toHaveURL(/\/medico$/);

    // Aguarda commit do evento (events.signIn e disparado fire-and-forget).
    await page.waitForTimeout(500);

    const erick = await db.user.findUnique({ where: { email: ERICK_EMAIL } });
    expect(erick).toBeTruthy();

    const log = await db.auditLog.findFirst({
      where: {
        action: "signin_success",
        userId: erick!.id,
        createdAt: { gte: before },
      },
      orderBy: { createdAt: "desc" },
    });

    expect(log).toBeTruthy();
    expect(log!.userId).toBe(erick!.id);
    expect(log!.action).toBe("signin_success");
  });

  test("login com senha errada cria entry signin_failed", async ({ page }) => {
    const before = new Date();
    await login(page, "medico", ERICK_EMAIL, "senha-errada-xxxxx");
    // RBAC v2: senha errada NAO redireciona — mostra erro inline e fica em /<slug>/login.
    await expect(loginError(page)).toBeVisible();
    await expect(page).toHaveURL(/\/medico\/login/);

    await page.waitForTimeout(500);

    const log = await db.auditLog.findFirst({
      where: {
        action: "signin_failed",
        createdAt: { gte: before },
      },
      orderBy: { createdAt: "desc" },
    });

    expect(log).toBeTruthy();
    expect(log!.action).toBe("signin_failed");
    // signin_failed nao tem userId (pre-auth), mas meta inclui email tentado
    const meta = log!.meta as { email?: string } | null;
    expect(meta?.email).toBe(ERICK_EMAIL);
  });
});
