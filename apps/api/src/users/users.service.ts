import { Injectable, NotFoundException } from "@nestjs/common";
import type { User } from "@ifp/database";

import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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
}
