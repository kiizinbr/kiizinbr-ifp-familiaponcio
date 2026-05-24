import { describe, it, expect } from "vitest";
import { z } from "zod";

// Mesmo schema do src/lib/env.ts — duplicado intencionalmente
// para testar sem disparar a validação que lê process.env real
// (importar env.ts dispara o safeParse no momento do import).
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32),
  AUTH_URL: z.string().url().optional(),
});

describe("env schema", () => {
  it("aceita config válida", () => {
    const result = envSchema.parse({
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://x:y@localhost:5432/z",
      AUTH_SECRET: "a".repeat(32),
    });
    expect(result.DATABASE_URL).toContain("postgresql");
    expect(result.NODE_ENV).toBe("development");
  });

  it("rejeita AUTH_SECRET curto", () => {
    expect(() =>
      envSchema.parse({
        DATABASE_URL: "postgresql://x:y@localhost:5432/z",
        AUTH_SECRET: "curto",
      }),
    ).toThrow();
  });

  it("rejeita DATABASE_URL inválida", () => {
    expect(() =>
      envSchema.parse({
        DATABASE_URL: "not-a-url",
        AUTH_SECRET: "a".repeat(32),
      }),
    ).toThrow();
  });

  it("default NODE_ENV é development quando omitido", () => {
    const result = envSchema.parse({
      DATABASE_URL: "postgresql://x:y@localhost:5432/z",
      AUTH_SECRET: "a".repeat(32),
    });
    expect(result.NODE_ENV).toBe("development");
  });
});
