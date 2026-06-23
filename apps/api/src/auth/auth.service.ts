import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AcaoAuditoria } from "@ifp/database";
import { compare, hash } from "bcrypt";

import { AuditService } from "../audit/audit.service";
import { UsersService } from "../users/users.service";

export interface JwtPayload {
  sub: string;
  email: string;
  perfis: string[];
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async login(email: string, senha: string) {
    const user = await this.users.findByEmail(email);
    if (!user || !user.ativo || !user.senhaHash) {
      throw new UnauthorizedException("Credenciais inválidas");
    }

    const ok = await compare(senha, user.senhaHash);
    if (!ok) {
      throw new UnauthorizedException("Credenciais inválidas");
    }

    const withPerfis = await this.users.findByIdWithPerfis(user.id);
    await this.users.registrarLogin(user.id);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      perfis: withPerfis.perfis.map((p) => p.perfil),
    };

    return {
      accessToken: await this.jwt.signAsync(payload),
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        perfis: payload.perfis,
        // Sinaliza ao front que a senha é provisória → forçar troca no 1º acesso.
        mustChangePassword: user.mustChangePassword,
        unidades: withPerfis.unidades.map((u) => ({
          id: u.unidade.id,
          slug: u.unidade.slug,
          tipo: u.unidade.tipo,
        })),
      },
    };
  }

  /**
   * Dados completos do próprio usuário ("Minha conta"). Enriquece o que o
   * JwtStrategy carrega (id/email/perfis) com nome e unidades vinculadas.
   * Auditamos como READ do próprio cadastro (dado pessoal — LGPD).
   */
  async me(userId: string) {
    const user = await this.users.findByIdWithPerfis(userId);

    this.audit.registrar({
      userId,
      acao: AcaoAuditoria.READ,
      entidade: "User",
      entidadeId: userId,
      metadados: { evento: "minha-conta" },
    });

    return {
      id: user.id,
      nome: user.nome,
      email: user.email,
      cpf: user.cpf,
      ativo: user.ativo,
      mustChangePassword: user.mustChangePassword,
      ultimoLogin: user.ultimoLogin,
      criadoEm: user.criadoEm,
      perfis: user.perfis.map((p) => p.perfil),
      unidades: user.unidades.map((u) => ({
        id: u.unidade.id,
        slug: u.unidade.slug,
        nome: u.unidade.nome,
        tipo: u.unidade.tipo,
      })),
    };
  }

  /**
   * Seletor de unidade pós-login: o usuário com acesso a mais de uma unidade
   * escolhe qual ativar. NÃO há "unidade ativa" persistida no servidor — o
   * contexto ativo é a rota/módulo em que o usuário navega; aqui apenas
   * VALIDAMOS que a unidade é uma das do próprio usuário (RBAC: só troca entre
   * as PRÓPRIAS unidades) e devolvemos os dados dela para o front recarregar o
   * contexto. Unidade fora do escopo (ou inexistente) → 404 anti-enumeração,
   * padrão do repo. SUPER_ADMIN não tem lotação, então a regra vale igual: só
   * troca para unidades vinculadas a ele.
   */
  async escolherUnidade(userId: string, unidadeId: string) {
    const user = await this.users.findByIdWithPerfis(userId);
    const vinculo = user.unidades.find((u) => u.unidade.id === unidadeId);
    if (!vinculo) {
      throw new NotFoundException("Unidade não encontrada");
    }

    // Auditoria LGPD: registra a troca de contexto (sem expor dado sensível).
    this.audit.registrar({
      userId,
      acao: AcaoAuditoria.READ,
      entidade: "Unidade",
      entidadeId: unidadeId,
      metadados: { evento: "escolher-unidade-ativa", slug: vinculo.unidade.slug },
    });

    return {
      id: vinculo.unidade.id,
      slug: vinculo.unidade.slug,
      nome: vinculo.unidade.nome,
      tipo: vinculo.unidade.tipo,
    };
  }

  /** Troca da própria senha (valida a senha atual). Limpa o flag de 1º acesso. */
  async trocarSenha(userId: string, senhaAtual: string, novaSenha: string) {
    const user = await this.users.findById(userId);
    if (!user || !user.senhaHash) {
      throw new UnauthorizedException("Sessão inválida");
    }

    const ok = await compare(senhaAtual, user.senhaHash);
    if (!ok) {
      throw new UnauthorizedException("Senha atual incorreta");
    }
    if (novaSenha === senhaAtual) {
      throw new BadRequestException("A nova senha deve ser diferente da atual");
    }

    const senhaHash = await hash(novaSenha, 12);
    await this.users.atualizarSenha(userId, senhaHash);

    this.audit.registrar({
      userId,
      acao: AcaoAuditoria.UPDATE,
      entidade: "User",
      entidadeId: userId,
      metadados: { evento: "trocou-senha" },
    });

    return { ok: true };
  }
}
