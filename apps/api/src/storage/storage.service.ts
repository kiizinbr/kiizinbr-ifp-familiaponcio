import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Client as MinioClient } from "minio";

/**
 * Fundação de storage (Onda C1).
 *
 * Encapsula o cliente MinIO/S3 num único lugar: o resto da API fala com objetos
 * (documentos, fotos) só por aqui — putObject / presignedGetUrl / removeObject.
 *
 * Decisões:
 *  - As credenciais e o endpoint vêm do .env (MINIO_*). Nada hardcoded.
 *  - O bucket é criado de forma IDEMPOTENTE no boot (makeBucket só se não existir).
 *  - ⚠ Se o MinIO estiver fora do ar, o boot NÃO pode cair: o bootstrap do bucket
 *    é envolto em try/catch e só loga aviso. A API sobe mesmo sem storage; as
 *    rotas que usam storage é que falham (e o /admin/storage/health acusa).
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: MinioClient;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    const endPoint = this.config.get<string>("MINIO_ENDPOINT", "127.0.0.1");
    const port = Number(this.config.get<string>("MINIO_PORT", "9000"));
    // useSSL aceita "true"/"1"; default false (MinIO local em http).
    const useSSLRaw = this.config.get<string>("MINIO_USE_SSL", "false");
    const useSSL = useSSLRaw === "true" || useSSLRaw === "1";
    const accessKey = this.config.get<string>("MINIO_ACCESS_KEY", "");
    const secretKey = this.config.get<string>("MINIO_SECRET_KEY", "");
    this.bucket = this.config.get<string>("MINIO_BUCKET", "ifp-documentos");

    this.client = new MinioClient({ endPoint, port, useSSL, accessKey, secretKey });
  }

  /** Bucket configurado (para quem precisar montar caminhos/chaves). */
  get bucketName(): string {
    return this.bucket;
  }

  async onModuleInit() {
    // Bootstrap idempotente do bucket. NUNCA derruba o boot se o MinIO estiver fora.
    try {
      const existe = await this.client.bucketExists(this.bucket);
      if (!existe) {
        await this.client.makeBucket(this.bucket);
        this.logger.log(`Bucket "${this.bucket}" criado no MinIO`);
      } else {
        this.logger.log(`Bucket "${this.bucket}" já existe no MinIO`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `MinIO indisponível no boot (bucket "${this.bucket}" não verificado): ${msg}. ` +
          "A API sobe mesmo assim; rotas de storage falharão até o MinIO voltar.",
      );
    }
  }

  /**
   * Envia um objeto para o bucket.
   * @param objectName chave do objeto (ex.: "fichas/abc/doc.pdf")
   * @param body conteúdo (Buffer)
   * @param contentType MIME (vai em metadados; o download usa de volta)
   */
  async putObject(objectName: string, body: Buffer, contentType?: string): Promise<void> {
    const metaData = contentType ? { "Content-Type": contentType } : undefined;
    await this.client.putObject(this.bucket, objectName, body, body.length, metaData);
  }

  /**
   * URL pré-assinada de download (GET) com expiração.
   * Quem chama deve ANTES checar ownership/tenant/RBAC — esta URL não autentica.
   * @param expirySeconds validade (default 5 min)
   */
  async presignedGetUrl(objectName: string, expirySeconds = 300): Promise<string> {
    return this.client.presignedGetObject(this.bucket, objectName, expirySeconds);
  }

  /** Remove um objeto do bucket (idempotente do lado do MinIO). */
  async removeObject(objectName: string): Promise<void> {
    await this.client.removeObject(this.bucket, objectName);
  }

  /**
   * Round-trip de diagnóstico: put → presigned get → fetch → remove.
   * Usado pelo /admin/storage/health. Lança se qualquer etapa falhar.
   */
  async roundTrip(): Promise<void> {
    const objectName = `_health/${Date.now()}-${Math.random().toString(36).slice(2)}.txt`;
    const conteudo = Buffer.from(`health-check ${new Date().toISOString()}`, "utf-8");
    await this.putObject(objectName, conteudo, "text/plain");
    try {
      const url = await this.presignedGetUrl(objectName, 60);
      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error(`GET pré-assinado retornou ${resp.status}`);
      }
      const lido = Buffer.from(await resp.arrayBuffer());
      if (!lido.equals(conteudo)) {
        throw new Error("conteúdo lido difere do gravado");
      }
    } finally {
      // Sempre tenta limpar o objeto temporário, mesmo se o GET falhou.
      await this.removeObject(objectName).catch(() => undefined);
    }
  }
}
