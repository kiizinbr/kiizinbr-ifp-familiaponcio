import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AcaoAuditoria, Prisma } from "@ifp/database";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/current-user.decorator";
import type { CriarUnidadeDto } from "./dto/criar-unidade.dto";
import type { EditarUnidadeDto } from "./dto/editar-unidade.dto";

const unidadeSelect = {
  id: true,
  tipo: true,
  nome: true,
  slug: true,
  endereco: true,
  telefone: true,
  email: true,
  ativo: true,
  criadoEm: true,
  atualizadoEm: true,
  _count: { select: { usuarios: true } },
} satisfies Prisma.UnidadeSelect;

/**
 * CRUD de Unidades (tenants) — SUPER_ADMIN apenas (garantido no controller).
 * `tipo` é único no schema: só é possível criar um tipo ainda inexistente.
 * Desativar é soft (campo `ativo`), nunca DELETE — preserva vínculos e trilha.
 */
@Injectable()
export class UnidadesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listar(_user: AuthenticatedUser) {
    return this.prisma.unidade
      .findMany({ orderBy: { criadoEm: "asc" }, select: unidadeSelect })
      .then((items) => ({ items }));
  }

  async criar(user: AuthenticatedUser, dto: CriarUnidadeDto) {
    const slug = dto.slug.trim().toLowerCase();

    const colisao = await this.prisma.unidade.findFirst({
      where: { OR: [{ tipo: dto.tipo }, { slug }] },
      select: { tipo: true, slug: true },
    });
    if (colisao) {
      throw new ConflictException(
        colisao.slug === slug
          ? `Já existe unidade com o slug "${slug}".`
          : `Já existe uma unidade do tipo ${dto.tipo}.`,
      );
    }

    const unidade = await this.prisma.unidade
      .create({
        data: {
          tipo: dto.tipo,
          nome: dto.nome.trim(),
          slug,
          endereco: dto.endereco?.trim() || null,
          telefone: dto.telefone?.trim() || null,
          email: dto.email?.trim().toLowerCase() || null,
        },
        select: unidadeSelect,
      })
      .catch((e: unknown) => {
        // Rede de segurança para corrida entre o pré-check e o INSERT (tipo/slug @unique).
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          throw new ConflictException("Já existe unidade com esse tipo ou slug.");
        }
        throw e;
      });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.CREATE,
      entidade: "Unidade",
      entidadeId: unidade.id,
      metadados: { tipo: unidade.tipo, slug: unidade.slug },
    });
    return unidade;
  }

  private async carregar(id: string) {
    const unidade = await this.prisma.unidade.findUnique({ where: { id } });
    if (!unidade) throw new NotFoundException("Unidade não encontrada");
    return unidade;
  }

  async editar(user: AuthenticatedUser, id: string, dto: EditarUnidadeDto) {
    await this.carregar(id);
    const atualizada = await this.prisma.unidade.update({
      where: { id },
      data: {
        ...(dto.nome !== undefined ? { nome: dto.nome.trim() } : {}),
        ...(dto.endereco !== undefined ? { endereco: dto.endereco.trim() || null } : {}),
        ...(dto.telefone !== undefined ? { telefone: dto.telefone.trim() || null } : {}),
        ...(dto.email !== undefined ? { email: dto.email.trim().toLowerCase() || null } : {}),
      },
      select: unidadeSelect,
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.UPDATE,
      entidade: "Unidade",
      entidadeId: id,
      metadados: { campos: Object.keys(dto) },
    });
    return atualizada;
  }

  async definirAtivo(user: AuthenticatedUser, id: string, ativo: boolean) {
    await this.carregar(id);
    const atualizada = await this.prisma.unidade.update({
      where: { id },
      data: { ativo },
      select: unidadeSelect,
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.UPDATE,
      entidade: "Unidade",
      entidadeId: id,
      metadados: { evento: ativo ? "reativar" : "desativar" },
    });
    return atualizada;
  }
}
