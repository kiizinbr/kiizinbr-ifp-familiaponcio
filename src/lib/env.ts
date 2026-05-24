import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET deve ter ao menos 32 caracteres"),
  AUTH_URL: z.string().url().optional(),
  // MinIO (Plano 3 T4)
  MINIO_HOST: z.string().default("localhost"),
  MINIO_PORT: z.coerce.number().int().default(9000),
  MINIO_USE_SSL: z
    .union([z.literal("true"), z.literal("false")])
    .default("false")
    .transform((v) => v === "true"),
  MINIO_ACCESS_KEY: z.string().default("ifp_minio"),
  MINIO_SECRET_KEY: z.string().default("ifp_minio_dev_pw"),
  MINIO_BUCKET_CIDADAO: z.string().default("ifp-cidadao-anexos"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Env inválido:", parsed.error.flatten().fieldErrors);
  throw new Error("Variáveis de ambiente inválidas. Cheque .env.local");
}

export const env = parsed.data;
export const envSchemaForTests = envSchema;
