import { randomBytes } from "node:crypto";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from "@nestjs/common";
import { AcaoAuditoria, TipoDocumento } from "@ifp/database";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";

/** Teto de tamanho do upload (8 MB). Documentos de cadastro (RG, comprovantes,
 * laudos) cabem com folga; arquivos maiores são quase sempre erro/abuso. */
const TAMANHO_MAX_BYTES = 8 * 1024 * 1024;

/** MIME aceitos: só PDF e imagens comuns de documento. Bloqueia executáveis,
 * HTML (XSS no download), etc. A chave é o MIME; o sufixo é só cosmético. */
const MIME_PERMITIDOS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

@Injectable()
export class DocumentosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  /** Garante que a ficha existe e devolve seus campos-chave (404 se não). */
  private async assertFicha(fichaId: string) {
    const ficha = await this.prisma.fichaCidada.findUnique({
      where: { id: fichaId },
      select: { id: true, protocolo: true },
    });
    if (!ficha) throw new NotFoundException("Ficha não encontrada");
    return ficha;
  }

  /**
   * Recupera o documento garantindo que ele PERTENCE à ficha do caminho.
   * É a barreira anti-IDOR: um docId válido de OUTRA ficha responde 404 aqui,
   * então não dá para baixar/excluir documento de família alheia trocando a URL.
   */
  private async assertDocumentoDaFicha(fichaId: string, docId: string) {
    const doc = await this.prisma.documento.findUnique({ where: { id: docId } });
    if (!doc || doc.fichaId !== fichaId) {
      throw new NotFoundException("Documento não encontrado nesta ficha");
    }
    return doc;
  }

  /** Chave do objeto no MinIO: namespaced por ficha + nome aleatório (evita
   * colisão e adivinhação). Mantém a extensão derivada do MIME validado. */
  private montarObjectName(fichaId: string, ext: string) {
    const aleatorio = randomBytes(16).toString("hex");
    return `fichas/${fichaId}/${aleatorio}.${ext}`;
  }

  /**
   * Sobe um arquivo para o MinIO e cria a linha `Documento` (model já existe →
   * ZERO-MIGRATION). Valida tamanho e MIME ANTES de gravar. A `url` guardada é
   * a CHAVE do objeto (não uma URL pública): o download gera presigned na hora.
   */
  async upload(
    fichaId: string,
    tipo: TipoDocumento,
    arquivo: Express.Multer.File | undefined,
    autorId: string,
  ) {
    const ficha = await this.assertFicha(fichaId);

    if (!arquivo) {
      throw new BadRequestException("Nenhum arquivo enviado (campo 'arquivo').");
    }
    if (arquivo.size > TAMANHO_MAX_BYTES) {
      throw new PayloadTooLargeException(
        `Arquivo acima do limite de ${Math.floor(TAMANHO_MAX_BYTES / (1024 * 1024))} MB.`,
      );
    }
    const ext = MIME_PERMITIDOS[arquivo.mimetype];
    if (!ext) {
      throw new UnsupportedMediaTypeException(
        "Tipo de arquivo não permitido. Aceitos: PDF, JPG, PNG.",
      );
    }

    const objectName = this.montarObjectName(fichaId, ext);
    await this.storage.putObject(objectName, arquivo.buffer, arquivo.mimetype);

    const doc = await this.prisma.documento.create({
      data: {
        fichaId,
        tipo,
        // nome original do arquivo (saneado p/ não carregar caminho/reservados).
        nomeArquivo: this.sanitizarNome(arquivo.originalname),
        url: objectName,
        tamanhoBytes: arquivo.size,
        mimeType: arquivo.mimetype,
        enviadoPor: autorId,
      },
    });

    // Trilha LGPD: anexar documento a uma família é manuseio de dado pessoal.
    this.audit.registrar({
      userId: autorId,
      acao: AcaoAuditoria.CREATE,
      entidade: "Documento",
      entidadeId: doc.id,
      metadados: {
        fichaId,
        protocolo: ficha.protocolo,
        tipo,
        mimeType: arquivo.mimetype,
        tamanhoBytes: arquivo.size,
      },
    });

    return this.semChave(doc);
  }

  /** Lista os documentos da ficha (sem expor a chave interna do storage). */
  async listar(fichaId: string, leitorId: string) {
    await this.assertFicha(fichaId);
    const docs = await this.prisma.documento.findMany({
      where: { fichaId },
      orderBy: { enviadoEm: "desc" },
    });

    this.audit.registrar({
      userId: leitorId,
      acao: AcaoAuditoria.READ,
      entidade: "Documento.lista",
      entidadeId: fichaId,
      metadados: { fichaId, total: docs.length },
    });

    return docs.map((d) => this.semChave(d));
  }

  /**
   * Gera uma URL pré-assinada de download. Checa ownership (doc é DESTA ficha)
   * ANTES — a presigned em si não autentica, então a checagem é aqui. Cada
   * download de documento de família entra na trilha LGPD (READ).
   */
  async urlDownload(fichaId: string, docId: string, leitorId: string) {
    await this.assertFicha(fichaId);
    const doc = await this.assertDocumentoDaFicha(fichaId, docId);

    const url = await this.storage.presignedGetUrl(doc.url, 120);

    this.audit.registrar({
      userId: leitorId,
      acao: AcaoAuditoria.READ,
      entidade: "Documento.download",
      entidadeId: doc.id,
      metadados: { fichaId, tipo: doc.tipo, nomeArquivo: doc.nomeArquivo },
    });

    return { url, nomeArquivo: doc.nomeArquivo, mimeType: doc.mimeType, expiraEm: 120 };
  }

  /**
   * Remove o documento: tira do MinIO E apaga a linha. Best-effort no MinIO
   * (removeObject é idempotente; se o objeto já sumiu, segue removendo a linha
   * para não deixar registro órfão).
   */
  async remover(fichaId: string, docId: string, autorId: string) {
    await this.assertFicha(fichaId);
    const doc = await this.assertDocumentoDaFicha(fichaId, docId);

    await this.storage.removeObject(doc.url).catch(() => undefined);
    await this.prisma.documento.delete({ where: { id: doc.id } });

    this.audit.registrar({
      userId: autorId,
      acao: AcaoAuditoria.DELETE,
      entidade: "Documento",
      entidadeId: doc.id,
      metadados: { fichaId, tipo: doc.tipo, nomeArquivo: doc.nomeArquivo },
    });

    return { removido: true, id: doc.id };
  }

  /** Saneia o nome do arquivo: só o basename, sem barras/reservados/controle. */
  private sanitizarNome(nome: string): string {
    const base = (nome ?? "arquivo").split(/[\\/]/).pop() ?? "arquivo";
    // Mantém só caracteres seguros de nome de arquivo (allowlist).
    const seguro = base.replace(/[^A-Za-z0-9._ ()-]+/g, "_").trim();
    return (seguro || "arquivo").slice(0, 200);
  }

  /** Remove a chave interna do storage (`url`) do payload exposto ao cliente.
   * O front nunca precisa da chave — baixa sempre pela rota presigned. */
  private semChave<T extends { url: string }>(doc: T): Omit<T, "url"> {
    const { url: _url, ...resto } = doc;
    return resto;
  }
}
