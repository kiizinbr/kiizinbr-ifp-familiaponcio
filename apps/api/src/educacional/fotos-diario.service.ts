import { randomBytes } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from "@nestjs/common";
import { AcaoAuditoria, Prisma, StatusDiario, TipoUnidade } from "@ifp/database";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/current-user.decorator";
import { StorageService } from "../storage/storage.service";
import { ProfissionaisService } from "../medico/profissionais.service";
import { CriancasService } from "./criancas.service";
import { janelaDoDiaSP } from "./dia-util";

/** Teto por foto (8 MB) — fotos de celular do dia a dia cabem com folga; acima
 * disso é quase sempre erro/abuso. Mesmo teto dos documentos da ficha (C2). */
const TAMANHO_MAX_BYTES = 8 * 1024 * 1024;

/** MIME aceitos: só imagens de foto. O diário afetivo é foto, não PDF/documento.
 * A chave é o MIME (não o sufixo): bloqueia HTML/exe/etc. (XSS no download). */
const MIME_PERMITIDOS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MSG_DIARIO_FECHADO =
  "Diário fechado — fotos não podem ser anexadas após o selo.";

/**
 * Fotos afetivas do diário da creche (Onda C3).
 *
 * Dois lados, ownership distinto (mesma disciplina do resto do educacional):
 *  - EDUCADORA: resolve o Profissional (parede de TipoUnidade.EDUCACIONAL) e só
 *    age sobre criança da PRÓPRIA unidade (assertCriancaDaUnidade). Anexa foto
 *    ao diário do dia (cria o diário se preciso, igual ao lançamento de rotina);
 *    diário FECHADO é imutável (409).
 *  - FAMÍLIA: ownership por User.fichaCidadaId; só vê fotos de diário FECHADO
 *    (selo) da PRÓPRIA criança. Diário aberto / criança de outra família → não
 *    vaza (lista vazia / 403 / 404 conforme o caso).
 *
 * A `url` guardada é a CHAVE do objeto no MinIO (não pública): o download é
 * sempre por presigned, com a checagem de ownership ANTES (a presigned não
 * autentica). Toda leitura/escrita entra na trilha LGPD (imagem de menor).
 */
@Injectable()
export class FotosDiarioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly profissionais: ProfissionaisService,
    private readonly criancas: CriancasService,
  ) {}

  /** Chave do objeto no MinIO: namespaced por diário + nome aleatório (sem
   * colisão nem adivinhação). Mantém a extensão derivada do MIME validado. */
  private montarObjectName(diarioId: string, ext: string) {
    const aleatorio = randomBytes(16).toString("hex");
    return `diarios/${diarioId}/fotos/${aleatorio}.${ext}`;
  }

  /** Não expõe a chave interna do storage (`url`) no payload do cliente — o
   * front baixa sempre pela rota presigned, nunca pela chave. */
  private semChave<T extends { url: string }>(foto: T): Omit<T, "url"> {
    const { url: _url, ...resto } = foto;
    return resto;
  }

  // ───────────────────────── lado EDUCADORA ─────────────────────────

  /**
   * Anexa uma foto ao diário do dia da criança. Cria o diário do dia se ainda
   * não existir (mesmo upsert + lock FOR UPDATE do lançamento de rotina, para
   * serializar com o fechamento). Diário FECHADO → 409 (imutável após o selo).
   * Valida tamanho/MIME ANTES de gravar no MinIO.
   */
  async anexar(
    user: AuthenticatedUser,
    membroId: string,
    arquivo: Express.Multer.File | undefined,
    legenda: string | undefined,
  ) {
    const profissional = await this.profissionais.resolverPorUser(
      user,
      TipoUnidade.EDUCACIONAL,
    );
    await this.criancas.assertCriancaDaUnidade(membroId, profissional.unidadeId);

    if (!arquivo) {
      throw new BadRequestException("Nenhuma foto enviada (campo 'arquivo').");
    }
    if (arquivo.size > TAMANHO_MAX_BYTES) {
      throw new PayloadTooLargeException(
        `Foto acima do limite de ${Math.floor(TAMANHO_MAX_BYTES / (1024 * 1024))} MB.`,
      );
    }
    const ext = MIME_PERMITIDOS[arquivo.mimetype];
    if (!ext) {
      throw new UnsupportedMediaTypeException(
        "Tipo de arquivo não permitido. Aceitos: JPG, PNG, WEBP.",
      );
    }

    const { dataDb } = janelaDoDiaSP();

    // 1) Garante o diário do dia ABERTO (cria se preciso) sob lock — mesma
    //    disciplina do registrarRotina: sem janela para anexar após o selo.
    const diario = await this.prisma.$transaction(async (tx) => {
      const d = await tx.diarioDia.upsert({
        where: { membroId_data: { membroId, data: dataDb } },
        update: {},
        create: { unidadeId: profissional.unidadeId, membroId, data: dataDb },
      });

      const [lockado] = await tx.$queryRaw<{ status: StatusDiario }[]>`
        SELECT status FROM diarios_dia WHERE id = ${d.id} FOR UPDATE
      `;
      if (!lockado) throw new NotFoundException("Diário não encontrado");
      if (lockado.status === StatusDiario.FECHADO) {
        throw new ConflictException(MSG_DIARIO_FECHADO);
      }
      return d;
    });

    // 2) Sobe ao MinIO e cria a linha FotoDiario.
    const objectName = this.montarObjectName(diario.id, ext);
    await this.storage.putObject(objectName, arquivo.buffer, arquivo.mimetype);

    const foto = await this.prisma.fotoDiario.create({
      data: {
        diarioId: diario.id,
        url: objectName,
        nomeArquivo: this.sanitizarNome(arquivo.originalname),
        mimeType: arquivo.mimetype,
        tamanhoBytes: arquivo.size,
        legenda: legenda?.trim() || null,
        profissionalId: profissional.id,
      },
    });

    // Imagem de menor é dado sensível — anexar entra na trilha LGPD.
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.CREATE,
      entidade: "FotoDiario",
      entidadeId: foto.id,
      metadados: { membroId, diarioId: diario.id, mimeType: arquivo.mimetype },
    });

    return this.semChave(foto);
  }

  /** Fotos do diário do dia (visão da educadora) — da PRÓPRIA unidade. */
  async listarEducadora(user: AuthenticatedUser, membroId: string, data?: string) {
    const profissional = await this.profissionais.resolverPorUser(
      user,
      TipoUnidade.EDUCACIONAL,
    );
    await this.criancas.assertCriancaDaUnidade(membroId, profissional.unidadeId);
    const { dataDb } = janelaDoDiaSP(data);

    const fotos = await this.fotosDoDia(membroId, dataDb);
    return { items: fotos.map((f) => this.semChave(f)) };
  }

  /** URL pré-assinada de download (educadora) — checa unidade ANTES. */
  async downloadEducadora(user: AuthenticatedUser, fotoId: string) {
    const profissional = await this.profissionais.resolverPorUser(
      user,
      TipoUnidade.EDUCACIONAL,
    );
    const foto = await this.prisma.fotoDiario.findUnique({
      where: { id: fotoId },
      include: { diario: { select: { unidadeId: true, membroId: true } } },
    });
    // Anti-enumeração: foto de OUTRA unidade responde 404 (não confirma o id).
    if (!foto || foto.diario.unidadeId !== profissional.unidadeId) {
      throw new NotFoundException("Foto não encontrada");
    }
    return this.presignarEAuditar(user, foto, "educacional.fotoDownload");
  }

  /** Remove a foto: tira do MinIO E apaga a linha. Diário FECHADO → 409
   * (o selo torna o diário imutável, fotos inclusive). Da PRÓPRIA unidade. */
  async remover(user: AuthenticatedUser, fotoId: string) {
    const profissional = await this.profissionais.resolverPorUser(
      user,
      TipoUnidade.EDUCACIONAL,
    );
    const foto = await this.prisma.fotoDiario.findUnique({
      where: { id: fotoId },
      include: { diario: { select: { unidadeId: true, status: true, membroId: true } } },
    });
    if (!foto || foto.diario.unidadeId !== profissional.unidadeId) {
      throw new NotFoundException("Foto não encontrada");
    }
    if (foto.diario.status === StatusDiario.FECHADO) {
      throw new ConflictException(MSG_DIARIO_FECHADO);
    }

    await this.storage.removeObject(foto.url).catch(() => undefined);
    await this.prisma.fotoDiario.delete({ where: { id: foto.id } });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.DELETE,
      entidade: "FotoDiario",
      entidadeId: foto.id,
      metadados: { membroId: foto.diario.membroId, diarioId: foto.diarioId },
    });

    return { removido: true, id: foto.id };
  }

  // ───────────────────────── lado FAMÍLIA ─────────────────────────

  /**
   * Fotos do diário FECHADO do dia, por criança (visão da família). Diário
   * ABERTO não devolve nada (selo). Ownership por User.fichaCidadaId.
   */
  async listarFamilia(user: AuthenticatedUser, membroId: string, data?: string) {
    await this.assertCriancaDaFamilia(user, membroId);
    const { dataDb } = janelaDoDiaSP(data);

    const fotos = await this.fotosDoDia(membroId, dataDb, StatusDiario.FECHADO);

    // Leitura de imagem de menor pelo responsável também é auditada.
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "FotoDiario.lista",
      entidadeId: membroId,
      metadados: { contexto: "familia.fotosDiario", membroId, total: fotos.length },
    });

    return { items: fotos.map((f) => this.semChave(f)) };
  }

  /**
   * URL pré-assinada de download (família). Checa ANTES: a foto é de criança
   * da própria família E está num diário FECHADO (selo). Foto de diário aberto
   * ou de outra família → 404 (não vaza, não confirma o id).
   */
  async downloadFamilia(user: AuthenticatedUser, fotoId: string) {
    const fichaId = await this.resolverFichaId(user);
    const foto = await this.prisma.fotoDiario.findUnique({
      where: { id: fotoId },
      include: {
        diario: { select: { status: true, membroId: true, crianca: { select: { fichaId: true } } } },
      },
    });
    if (
      !foto ||
      foto.diario.crianca.fichaId !== fichaId ||
      foto.diario.status !== StatusDiario.FECHADO
    ) {
      throw new NotFoundException("Foto não encontrada");
    }
    return this.presignarEAuditar(user, foto, "familia.fotoDownload");
  }

  // ───────────────────────── helpers ─────────────────────────

  /** Fotos de um diário do dia (opcionalmente só se em dado status). */
  private async fotosDoDia(membroId: string, dataDb: Date, status?: StatusDiario) {
    const where: Prisma.DiarioDiaWhereInput = { membroId, data: dataDb };
    if (status) where.status = status;
    const diario = await this.prisma.diarioDia.findFirst({
      where,
      include: { fotos: { orderBy: { criadoEm: "asc" } } },
    });
    return diario?.fotos ?? [];
  }

  /** Presigna o download e registra o READ (LGPD). */
  private async presignarEAuditar(
    user: AuthenticatedUser,
    foto: { id: string; url: string; nomeArquivo: string; mimeType: string },
    contexto: string,
  ) {
    const url = await this.storage.presignedGetUrl(foto.url, 120);
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "FotoDiario.download",
      entidadeId: foto.id,
      metadados: { contexto, nomeArquivo: foto.nomeArquivo },
    });
    return { url, nomeArquivo: foto.nomeArquivo, mimeType: foto.mimeType, expiraEm: 120 };
  }

  /** O elo login→ficha do responsável; nenhum endpoint aceita fichaId do client. */
  private async resolverFichaId(user: AuthenticatedUser): Promise<string> {
    const registro = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { fichaCidadaId: true },
    });
    if (!registro?.fichaCidadaId) {
      throw new ForbiddenException(
        "Seu usuário não está vinculado a uma ficha de família — procure a secretaria.",
      );
    }
    return registro.fichaCidadaId;
  }

  /** A criança é da família do usuário logado? Senão, 403 (IDOR). */
  private async assertCriancaDaFamilia(user: AuthenticatedUser, membroId: string) {
    const fichaId = await this.resolverFichaId(user);
    const crianca = await this.prisma.membroFamiliar.findFirst({
      where: { id: membroId, fichaId },
      select: { id: true },
    });
    if (!crianca) {
      throw new ForbiddenException("Esta criança não pertence à sua família.");
    }
    return fichaId;
  }

  /** Saneia o nome do arquivo: só o basename, sem barras/reservados/controle. */
  private sanitizarNome(nome: string): string {
    const base = (nome ?? "foto").split(/[\\/]/).pop() ?? "foto";
    const seguro = base.replace(/[^A-Za-z0-9._ ()-]+/g, "_").trim();
    return (seguro || "foto").slice(0, 200);
  }
}
