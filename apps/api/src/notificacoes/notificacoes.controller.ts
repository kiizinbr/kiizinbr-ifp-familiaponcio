import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { CurrentUser, type AuthenticatedUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { NotificacoesService } from "./notificacoes.service";

/**
 * Central de Avisos (sino da topbar). Auth normal (qualquer perfil): o service
 * decide QUAIS sinais cada perfil vê, sempre respeitando RBAC + tenant.
 */
@ApiTags("notificacoes")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("notificacoes")
export class NotificacoesController {
  constructor(private readonly notificacoes: NotificacoesService) {}

  @Get()
  @ApiOperation({
    summary: "Avisos do usuário logado (agregação read-only de sinais reais, por perfil)",
  })
  listar(@CurrentUser() user: AuthenticatedUser) {
    return this.notificacoes.listar(user);
  }
}
