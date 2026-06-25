import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AcaoAuditoria, Perfil, TipoUnidade } from "@ifp/database";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/current-user.decorator";
import {
  CATALOGO_PARAMETROS,
  desserializar,
  getDefParametro,
  serializarValidando,
} from "./config.parametros";

/** Um parâmetro do catálogo já resolvido (default + override do banco). */
interface ParametroResolvido {
  chave: string;
  rotulo: string;
  descricao: string;
  tipo: "boolean" | "number" | "string";
  valor: boolean | number | string;
  padrao: boolean | number | string;
  personalizado: boolean; // true = há override no banco
  min?: number;
  max?: number;
  maxLength?: number;
  atualizadoEm: string | null;
}

/**
 * Painel de Configuração da plataforma (A6) — SUPER_ADMIN apenas (garantido no
 * controller). LÊ a config existente (unidades, perfis disponíveis) e resolve
 * os parâmetros simples (catálogo na app + overrides na tabela `Configuracao`).
 * Ajusta parâmetros conhecidos; toda alteração gera AuditLog (LGPD).
 *
 * Reusa o que já existe: não duplica o CRUD de Unidade — só expõe um resumo
 * read-only das unidades (o CRUD continua em /admin/unidades).
 */
@Injectable()
export class ConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Lê os overrides persistidos (chave -> {valor, atualizadoEm}). */
  private async carregarOverrides(): Promise<
    Map<string, { valor: string; atualizadoEm: Date }>
  > {
    const rows = await this.prisma.configuracao.findMany({
      where: { chave: { in: CATALOGO_PARAMETROS.map((p) => p.chave) } },
      select: { chave: true, valor: true, atualizadoEm: true },
    });
    return new Map(rows.map((r) => [r.chave, { valor: r.valor, atualizadoEm: r.atualizadoEm }]));
  }

  /** Resolve os parâmetros do catálogo aplicando os overrides do banco. */
  private resolverParametros(
    overrides: Map<string, { valor: string; atualizadoEm: Date }>,
  ): ParametroResolvido[] {
    return CATALOGO_PARAMETROS.map((def) => {
      const ov = overrides.get(def.chave);
      const valor = ov ? desserializar(def, ov.valor) : def.padrao;
      return {
        chave: def.chave,
        rotulo: def.rotulo,
        descricao: def.descricao,
        tipo: def.tipo,
        valor,
        padrao: def.padrao,
        personalizado: Boolean(ov),
        ...(def.min !== undefined ? { min: def.min } : {}),
        ...(def.max !== undefined ? { max: def.max } : {}),
        ...(def.maxLength !== undefined ? { maxLength: def.maxLength } : {}),
        atualizadoEm: ov ? ov.atualizadoEm.toISOString() : null,
      };
    });
  }

  /**
   * Config completa da plataforma para o painel: resumo das unidades, perfis
   * disponíveis e parâmetros resolvidos. A leitura é auditada (LGPD).
   */
  async lerConfig(user: AuthenticatedUser) {
    const [unidades, overrides] = await Promise.all([
      this.prisma.unidade.findMany({
        orderBy: { criadoEm: "asc" },
        select: {
          id: true,
          tipo: true,
          nome: true,
          slug: true,
          ativo: true,
          _count: { select: { usuarios: true } },
        },
      }),
      this.carregarOverrides(),
    ]);

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "Configuracao",
      metadados: { escopo: "painel-config" },
    });

    return {
      unidades: unidades.map((u) => ({
        id: u.id,
        tipo: u.tipo,
        nome: u.nome,
        slug: u.slug,
        ativo: u.ativo,
        usuarios: u._count.usuarios,
      })),
      tiposUnidade: Object.values(TipoUnidade),
      perfis: Object.values(Perfil),
      parametros: this.resolverParametros(overrides),
    };
  }

  /**
   * Atualiza um parâmetro simples (upsert na tabela `Configuracao`). Valida a
   * chave contra a whitelist e o valor contra o tipo declarado. Gera AuditLog
   * com o antes/depois (governança LGPD).
   */
  async atualizarParametro(
    user: AuthenticatedUser,
    chave: string,
    valor: unknown,
  ): Promise<ParametroResolvido> {
    const def = getDefParametro(chave);
    if (!def) throw new NotFoundException(`Parâmetro "${chave}" não existe.`);

    const conv = serializarValidando(def, valor);
    if (!conv.ok) throw new BadRequestException(conv.erro);

    const anterior = await this.prisma.configuracao.findUnique({
      where: { chave },
      select: { valor: true },
    });
    const valorAnterior = anterior ? desserializar(def, anterior.valor) : def.padrao;

    await this.prisma.configuracao.upsert({
      where: { chave },
      create: { chave, valor: conv.texto, atualizadoPor: user.id },
      update: { valor: conv.texto, atualizadoPor: user.id },
    });

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.UPDATE,
      entidade: "Configuracao",
      entidadeId: chave,
      metadados: { chave, de: valorAnterior, para: conv.typed },
    });

    const overrides = await this.carregarOverrides();
    const resolvido = this.resolverParametros(overrides).find((p) => p.chave === chave);
    // Sempre existe (acabamos de gravar), mas o find é tipado como opcional.
    if (!resolvido) throw new NotFoundException(`Parâmetro "${chave}" não encontrado.`);
    return resolvido;
  }
}
