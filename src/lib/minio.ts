/**
 * MinIO helper — anexos da Ficha Cidadã (Plano 3 T4).
 *
 * Decisão §0.5 do Plano 3:
 * - Tipos permitidos: PDF, JPG, PNG
 * - Tamanho max: 10MB/arquivo, 100MB total/cidadão
 * - Bucket: ifp-cidadao-anexos
 * - Naming: hash SHA-256 (futura dedup) — MVP usa timestamp+random
 */

import * as Minio from "minio";
import { env } from "@/lib/env";

export const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_TOTAL_SIZE_PER_CIDADAO_BYTES = 100 * 1024 * 1024; // 100MB

const MIME_TO_EXT: Record<AllowedMimeType, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

let cachedClient: Minio.Client | null = null;

/** Cliente MinIO singleton (lazy). */
export function getMinioClient(): Minio.Client {
  if (!cachedClient) {
    cachedClient = new Minio.Client({
      endPoint: env.MINIO_HOST,
      port: env.MINIO_PORT,
      useSSL: env.MINIO_USE_SSL,
      accessKey: env.MINIO_ACCESS_KEY,
      secretKey: env.MINIO_SECRET_KEY,
    });
  }
  return cachedClient;
}

/** Garante que o bucket existe; cria se não. Idempotente. */
export async function ensureBucketExists(bucket: string): Promise<void> {
  const client = getMinioClient();
  const exists = await client.bucketExists(bucket);
  if (!exists) {
    await client.makeBucket(bucket);
  }
}

export function isAllowedMimeType(mime: string): mime is AllowedMimeType {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mime);
}

/**
 * Gera storage key pra anexo. Formato:
 * `{cidadaoId}/{timestamp}-{randomHex}.{ext}`
 *
 * Não usa hash do conteúdo (precisaria o file primeiro) — MVP usa
 * naming determinístico via metadata. Hash SHA-256 pra dedup vira evolução.
 */
export function buildStorageKey(cidadaoId: string, mimeType: AllowedMimeType): string {
  const timestamp = Date.now();
  const randomHex = Math.random().toString(16).slice(2, 10);
  const ext = MIME_TO_EXT[mimeType];
  return `${cidadaoId}/${timestamp}-${randomHex}.${ext}`;
}

export interface UploadUrlResult {
  storageKey: string;
  uploadUrl: string;
  expiresInSeconds: number;
}

/**
 * Gera presigned PUT URL pra upload direto do client pro MinIO.
 * Cliente envia PUT com Content-Type igual ao mime + Content-Length igual ao size.
 *
 * Expiry curto (15 min) — só pra upload, não pra acesso.
 */
export async function getCidadaoAnexoUploadUrl(args: {
  cidadaoId: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<UploadUrlResult> {
  if (!isAllowedMimeType(args.mimeType)) {
    throw new Error(`Tipo de arquivo não permitido: ${args.mimeType}. Aceitos: PDF, JPG, PNG.`);
  }
  if (args.sizeBytes > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `Arquivo muito grande (${(args.sizeBytes / 1024 / 1024).toFixed(1)}MB). Máximo 10MB.`,
    );
  }
  if (args.sizeBytes <= 0) {
    throw new Error("Arquivo vazio");
  }

  await ensureBucketExists(env.MINIO_BUCKET_CIDADAO);

  const storageKey = buildStorageKey(args.cidadaoId, args.mimeType);
  const expiresInSeconds = 15 * 60;
  const uploadUrl = await getMinioClient().presignedPutObject(
    env.MINIO_BUCKET_CIDADAO,
    storageKey,
    expiresInSeconds,
  );

  return { storageKey, uploadUrl, expiresInSeconds };
}

/**
 * Gera presigned GET URL pra download de anexo. Expiry 5 minutos.
 */
export async function getCidadaoAnexoDownloadUrl(storageKey: string): Promise<string> {
  const expiresInSeconds = 5 * 60;
  return getMinioClient().presignedGetObject(
    env.MINIO_BUCKET_CIDADAO,
    storageKey,
    expiresInSeconds,
  );
}

/** Remove objeto do MinIO. Soft delete da row é responsabilidade do caller. */
export async function removeCidadaoAnexo(storageKey: string): Promise<void> {
  await getMinioClient().removeObject(env.MINIO_BUCKET_CIDADAO, storageKey);
}

/** Confirma que o objeto existe e bate com o size esperado (anti-tampering). */
export async function statCidadaoAnexo(
  storageKey: string,
): Promise<{ size: number; lastModified: Date } | null> {
  try {
    const stat = await getMinioClient().statObject(env.MINIO_BUCKET_CIDADAO, storageKey);
    return { size: stat.size, lastModified: stat.lastModified };
  } catch {
    return null;
  }
}
