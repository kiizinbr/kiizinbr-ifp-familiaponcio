import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { compare } from "bcrypt";

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
        unidades: withPerfis.unidades.map((u) => ({
          id: u.unidade.id,
          slug: u.unidade.slug,
          tipo: u.unidade.tipo,
        })),
      },
    };
  }
}
