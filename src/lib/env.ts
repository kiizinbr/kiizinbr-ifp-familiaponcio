import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET deve ter ao menos 32 caracteres"),
  AUTH_URL: z.string().url().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Env inválido:", parsed.error.flatten().fieldErrors);
  throw new Error("Variáveis de ambiente inválidas. Cheque .env.local");
}

export const env = parsed.data;
export const envSchemaForTests = envSchema;
