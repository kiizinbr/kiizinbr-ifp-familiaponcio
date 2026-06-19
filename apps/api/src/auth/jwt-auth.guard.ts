import { ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";

import type { AuthenticatedUser } from "./current-user.decorator";
import { PERMITE_SENHA_PROVISORIA_KEY } from "./permite-senha-provisoria.decorator";

/**
 * Autentica via JWT e, depois de autenticar, IMPÕE a troca de senha obrigatória
 * no servidor: enquanto o usuário estiver com senha provisória
 * (mustChangePassword=true), só passam as rotas marcadas com
 * @PermiteSenhaProvisoria — qualquer outra responde 403. Isso vale para chamadas
 * diretas à API (não só para a navegação no front), e como o flag é lido do banco
 * no JwtStrategy, um reset feito por um admin barra a sessão antiga na hora.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const autenticado = (await super.canActivate(ctx)) as boolean;
    if (!autenticado) return false;

    const permitido = this.reflector.getAllAndOverride<boolean>(
      PERMITE_SENHA_PROVISORIA_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (permitido) return true;

    const { user } = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    if (user?.mustChangePassword) {
      throw new ForbiddenException(
        "Troca de senha obrigatória: defina uma nova senha antes de continuar.",
      );
    }
    return true;
  }
}
