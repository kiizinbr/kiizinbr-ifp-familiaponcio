import { Injectable } from "@nestjs/common";
import { AcaoAuditoria, Perfil, Prisma } from "@ifp/database";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/current-user.decorator";

/** Um resultado da busca global, já normalizado para o front (rótulo + link). */
export interface ResultadoBusca {
  tipo: "ficha" | "usuario";
  id: string;
  titulo: string;
  subtitulo: string;
  href: string;
}

export interface RespostaBusca {
  termo: string;
  total: number;
  resultados: ResultadoBusca[];
}

/** Quantos itens por categoria devolvemos no dropdown da topbar. */
const LIMITE_POR_CATEGORIA = 8;

/**
 * Busca global da topbar. Faz fan-out apenas nas entidades que o PERFIL do
 * usuário pode ver (RBAC honesto: nada de vazar fichas para quem não é da
 * equipe de Serviço Social, nem usuários para quem não administra ninguém).
 * Reusa os mesmos critérios de busca (`q`) das listagens já existentes.
 */
@Injectable()
export class BuscaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private podeVerFichas(user: AuthenticatedUser): boolean {
    return (
      user.perfis.includes(Perfil.SUPER_ADMIN) ||
      user.perfis.includes(Perfil.SERVICO_SOCIAL)
    );
  }

  private podeVerUsuarios(user: AuthenticatedUser): boolean {
    return (
      user.perfis.includes(Perfil.SUPER_ADMIN) ||
      user.perfis.includes(Perfil.GESTOR_UNIDADE)
    );
  }

  private async unidadeIdsDoUsuario(userId: string): Promise<string[]> {
    const vinculos = await this.prisma.usuarioUnidade.findMany({
      where: { userId },
      select: { unidadeId: true },
    });
    return vinculos.map((v) => v.unidadeId);
  }

  /** Fichas Cidadãs por nome (case-insensitive), protocolo ou CPF (só dígitos). */
  private async buscarFichas(termo: string): Promise<ResultadoBusca[]> {
    const digitos = termo.replace(/\D/g, "");
    const or: Prisma.FichaCidadaWhereInput[] = [
      { nomeCompleto: { contains: termo, mode: "insensitive" } },
      { protocolo: { contains: termo.toUpperCase() } },
    ];
    if (digitos.length >= 3) {
      or.push({ cpf: { contains: digitos } });
    }

    const fichas = await this.prisma.fichaCidada.findMany({
      where: { OR: or },
      orderBy: { nomeCompleto: "asc" },
      take: LIMITE_POR_CATEGORIA,
      select: { id: true, nomeCompleto: true, protocolo: true, cpf: true },
    });

    return fichas.map((f) => ({
      tipo: "ficha" as const,
      id: f.id,
      titulo: f.nomeCompleto,
      subtitulo: `Ficha ${f.protocolo}${f.cpf ? ` · ${f.cpf}` : ""}`,
      href: `/servico-social/fichas/${f.id}`,
    }));
  }

  /**
   * Usuários por nome/e-mail. GESTOR_UNIDADE só enxerga quem está lotado em
   * alguma de SUAS unidades (mesmo escopo da listagem de /users).
   */
  private async buscarUsuarios(
    user: AuthenticatedUser,
    termo: string,
  ): Promise<ResultadoBusca[]> {
    const isAdmin = user.perfis.includes(Perfil.SUPER_ADMIN);
    const escopo: Prisma.UserWhereInput = isAdmin
      ? {}
      : {
          unidades: {
            some: { unidadeId: { in: await this.unidadeIdsDoUsuario(user.id) } },
          },
        };

    const usuarios = await this.prisma.user.findMany({
      where: {
        AND: [
          escopo,
          {
            OR: [
              { nome: { contains: termo, mode: "insensitive" } },
              { email: { contains: termo, mode: "insensitive" } },
            ],
          },
        ],
      },
      orderBy: { nome: "asc" },
      take: LIMITE_POR_CATEGORIA,
      select: { id: true, nome: true, email: true, ativo: true },
    });

    return usuarios.map((u) => ({
      tipo: "usuario" as const,
      id: u.id,
      titulo: u.nome,
      subtitulo: `${u.email}${u.ativo ? "" : " · inativo"}`,
      href: "/admin/usuarios",
    }));
  }

  async buscar(user: AuthenticatedUser, termoBruto: string): Promise<RespostaBusca> {
    const termo = (termoBruto ?? "").trim();
    // Termo curto demais não busca (evita varrer a base inteira a cada tecla).
    if (termo.length < 2) {
      return { termo, total: 0, resultados: [] };
    }

    const lotes: ResultadoBusca[] = [];
    if (this.podeVerFichas(user)) {
      lotes.push(...(await this.buscarFichas(termo)));
    }
    if (this.podeVerUsuarios(user)) {
      lotes.push(...(await this.buscarUsuarios(user, termo)));
    }

    // LGPD: a busca toca em dado pessoal — registramos QUEM buscou e quanto
    // achou, mas nunca o termo em claro (poderia conter CPF/nome).
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "BuscaGlobal",
      metadados: { tamanhoTermo: termo.length, total: lotes.length },
    });

    return { termo, total: lotes.length, resultados: lotes };
  }
}
