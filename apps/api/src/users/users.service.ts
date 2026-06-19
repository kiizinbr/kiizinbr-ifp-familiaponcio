import { randomBytes } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AcaoAuditoria, Perfil, Prisma, type User } from "@ifp/database";
import { hash } from "bcrypt";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/current-user.decorator";
import type { CriarUsuarioDto } from "./dto/criar-usuario.dto";

/** Perfis que um GESTOR_UNIDADE pode conceder (nunca eleva acima de si mesmo). */
const PERFIS_PERMITIDOS_GESTOR: Perfil[] = [
  Perfil.PROFISSIONAL,
  Perfil.RECEPCAO,
  Perfil.RESPONSAVEL_FAMILIAR,
];

/** Alfabeto sem caracteres ambíguos (0/O, 1/l/I) para a senha provisória. */
const ALFABETO_SENHA = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ------------------------------------------------------------
  // Consultas usadas pelo fluxo de autenticação (mantidas)
  // ------------------------------------------------------------
  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByIdWithPerfis(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { perfis: true, unidades: { include: { unidade: true } } },
    });
    if (!user) throw new NotFoundException("Usuário não encontrado");
    return user;
  }

  registrarLogin(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { ultimoLogin: new Date() },
    });
  }

  /** Troca de senha do próprio usuário (chamada pelo AuthService). Limpa o flag. */
  atualizarSenha(userId: string, senhaHash: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { senhaHash, mustChangePassword: false },
    });
  }

  // ------------------------------------------------------------
  // Gestão de usuários (admin / gestor) — go-live de auth
  // ------------------------------------------------------------

  /** Senha provisória legível, mostrada na tela para o admin repassar. */
  private gerarSenhaProvisoria(tamanho = 12): string {
    const bytes = randomBytes(tamanho);
    let senha = "";
    for (const byte of bytes) {
      senha += ALFABETO_SENHA[byte % ALFABETO_SENHA.length] ?? "";
    }
    return senha;
  }

  /** Remove o hash de senha do objeto antes de devolver ao cliente. */
  private semSenha(user: User) {
    const { senhaHash: _omit, ...rest } = user;
    return rest;
  }

  private async unidadeIdsDoUsuario(userId: string): Promise<string[]> {
    const vinculos = await this.prisma.usuarioUnidade.findMany({
      where: { userId },
      select: { unidadeId: true },
    });
    return vinculos.map((v) => v.unidadeId);
  }

  /**
   * Carrega o usuário-alvo e valida que o `ator` pode geri-lo. SUPER_ADMIN gere
   * qualquer um; GESTOR_UNIDADE só quem está lotado em alguma de SUAS unidades.
   * Alvo fora do escopo → 404 (anti-enumeração, padrão do repo).
   */
  private async carregarGerenciavel(ator: AuthenticatedUser, alvoId: string) {
    const alvo = await this.prisma.user.findUnique({
      where: { id: alvoId },
      include: { unidades: { select: { unidadeId: true } } },
    });
    if (!alvo) throw new NotFoundException("Usuário não encontrado");
    if (ator.perfis.includes(Perfil.SUPER_ADMIN)) return alvo;

    const minhas = new Set(await this.unidadeIdsDoUsuario(ator.id));
    const temAcesso = alvo.unidades.some((u) => minhas.has(u.unidadeId));
    if (!temAcesso) throw new NotFoundException("Usuário não encontrado");
    return alvo;
  }

  async criar(ator: AuthenticatedUser, dto: CriarUsuarioDto) {
    const isAdmin = ator.perfis.includes(Perfil.SUPER_ADMIN);
    const email = dto.email.trim().toLowerCase();

    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictException(`Já existe usuário com o e-mail ${email}.`);
    }
    if (dto.cpf && (await this.prisma.user.findUnique({ where: { cpf: dto.cpf } }))) {
      throw new ConflictException("Já existe usuário com o CPF informado.");
    }

    // Resolve as unidades pelos slugs (todas precisam existir).
    const slugs = dto.unidades ?? [];
    const unidades = slugs.length
      ? await this.prisma.unidade.findMany({ where: { slug: { in: slugs } } })
      : [];
    if (unidades.length !== slugs.length) {
      throw new BadRequestException("Uma ou mais unidades informadas não existem.");
    }

    // RBAC de elevação: o gestor não pode conceder perfis acima de si nem lotar
    // o usuário fora das suas unidades. (O controller já garante ator admin|gestor.)
    if (!isAdmin) {
      const invalidos = dto.perfis.filter((p) => !PERFIS_PERMITIDOS_GESTOR.includes(p));
      if (invalidos.length) {
        throw new ForbiddenException(
          `Gestor de unidade não pode conceder: ${invalidos.join(", ")}.`,
        );
      }
      if (!unidades.length) {
        throw new ForbiddenException("Informe a unidade do novo usuário.");
      }
      const minhas = new Set(await this.unidadeIdsDoUsuario(ator.id));
      const fora = unidades.filter((u) => !minhas.has(u.id));
      if (fora.length) {
        throw new ForbiddenException(
          "Gestor de unidade só cria usuários nas próprias unidades.",
        );
      }
    }

    const senhaProvisoria = this.gerarSenhaProvisoria();
    const senhaHash = await hash(senhaProvisoria, 12);

    const novo = await this.prisma
      .$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            nome: dto.nome.trim(),
            email,
            cpf: dto.cpf ?? null,
            senhaHash,
            mustChangePassword: true,
            ativo: true,
          },
        });
        await tx.usuarioPerfil.createMany({
          data: dto.perfis.map((perfil) => ({ userId: user.id, perfil })),
        });
        if (unidades.length) {
          await tx.usuarioUnidade.createMany({
            data: unidades.map((u) => ({ userId: user.id, unidadeId: u.id })),
          });
        }
        return user;
      })
      .catch((e: unknown) => {
        // Rede de segurança para a corrida entre o pré-check e o INSERT: se duas
        // requisições criam o mesmo e-mail/CPF ao mesmo tempo, a @unique dispara
        // P2002 — traduzimos para 409 (senão escaparia como 500).
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          const alvo = String(e.meta?.target ?? "");
          if (alvo.includes("cpf")) {
            throw new ConflictException("Já existe usuário com o CPF informado.");
          }
          throw new ConflictException(`Já existe usuário com o e-mail ${email}.`);
        }
        throw e;
      });

    this.audit.registrar({
      userId: ator.id,
      acao: AcaoAuditoria.CREATE,
      entidade: "User",
      entidadeId: novo.id,
      metadados: { perfis: dto.perfis, unidades: slugs },
    });

    // A senha provisória só existe aqui (nunca persiste em claro).
    return {
      user: this.semSenha(novo),
      senhaProvisoria,
      perfis: dto.perfis,
      unidades: unidades.map((u) => ({ slug: u.slug, nome: u.nome })),
    };
  }

  async listar(ator: AuthenticatedUser) {
    const isAdmin = ator.perfis.includes(Perfil.SUPER_ADMIN);
    const where = isAdmin
      ? {}
      : {
          unidades: {
            some: { unidadeId: { in: await this.unidadeIdsDoUsuario(ator.id) } },
          },
        };

    const users = await this.prisma.user.findMany({
      where,
      orderBy: { criadoEm: "desc" },
      select: {
        id: true,
        nome: true,
        email: true,
        cpf: true,
        ativo: true,
        mustChangePassword: true,
        ultimoLogin: true,
        criadoEm: true,
        perfis: { select: { perfil: true } },
        unidades: { select: { unidade: { select: { slug: true, nome: true } } } },
      },
    });

    this.audit.registrar({
      userId: ator.id,
      acao: AcaoAuditoria.READ,
      entidade: "User",
      metadados: { total: users.length },
    });

    return {
      items: users.map((u) => ({
        id: u.id,
        nome: u.nome,
        email: u.email,
        cpf: u.cpf,
        ativo: u.ativo,
        mustChangePassword: u.mustChangePassword,
        ultimoLogin: u.ultimoLogin,
        criadoEm: u.criadoEm,
        perfis: u.perfis.map((p) => p.perfil),
        unidades: u.unidades.map((x) => x.unidade),
      })),
    };
  }

  async resetarSenha(ator: AuthenticatedUser, alvoId: string) {
    if (ator.id === alvoId) {
      throw new BadRequestException(
        "Para trocar a sua própria senha use a opção de troca (que pede a senha atual).",
      );
    }
    const alvo = await this.carregarGerenciavel(ator, alvoId);
    const senhaProvisoria = this.gerarSenhaProvisoria();
    const senhaHash = await hash(senhaProvisoria, 12);

    await this.prisma.user.update({
      where: { id: alvo.id },
      data: { senhaHash, mustChangePassword: true },
    });

    this.audit.registrar({
      userId: ator.id,
      acao: AcaoAuditoria.UPDATE,
      entidade: "User",
      entidadeId: alvo.id,
      metadados: { evento: "reset-senha" },
    });

    return { senhaProvisoria };
  }

  async definirAtivo(ator: AuthenticatedUser, alvoId: string, ativo: boolean) {
    if (ator.id === alvoId && !ativo) {
      throw new BadRequestException("Você não pode desativar a si mesmo.");
    }
    const alvo = await this.carregarGerenciavel(ator, alvoId);

    // Nunca deixar o sistema sem nenhum Super Admin ativo (lockout administrativo).
    if (!ativo) {
      const alvoEhSuperAdmin = await this.prisma.usuarioPerfil.findUnique({
        where: { userId_perfil: { userId: alvo.id, perfil: Perfil.SUPER_ADMIN } },
      });
      if (alvoEhSuperAdmin) {
        const superAdminsAtivos = await this.prisma.user.count({
          where: { ativo: true, perfis: { some: { perfil: Perfil.SUPER_ADMIN } } },
        });
        if (superAdminsAtivos <= 1) {
          throw new BadRequestException(
            "Não é possível desativar o último Super Admin ativo.",
          );
        }
      }
    }

    const atualizado = await this.prisma.user.update({
      where: { id: alvo.id },
      data: { ativo },
    });

    this.audit.registrar({
      userId: ator.id,
      acao: AcaoAuditoria.UPDATE,
      entidade: "User",
      entidadeId: alvo.id,
      metadados: { evento: ativo ? "reativar" : "desativar" },
    });

    return this.semSenha(atualizado);
  }
}
