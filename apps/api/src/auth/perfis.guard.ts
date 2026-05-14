import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Perfil } from "@ifp/database";

import type { AuthenticatedUser } from "./current-user.decorator";
import { PERFIS_KEY } from "./perfis.decorator";

@Injectable()
export class PerfisGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Perfil[] | undefined>(PERFIS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    if (!user) throw new ForbiddenException("Usuário não autenticado");

    const ok = user.perfis.some((p) => required.includes(p as Perfil));
    if (!ok) {
      throw new ForbiddenException(
        `Requer perfil: ${required.join(" ou ")}. Você tem: ${user.perfis.join(", ") || "(nenhum)"}.`,
      );
    }
    return true;
  }
}
