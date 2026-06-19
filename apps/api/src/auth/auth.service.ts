import {
  BadRequestException,
  Injectable,
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
