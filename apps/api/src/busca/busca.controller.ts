import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { CurrentUser, type AuthenticatedUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { BuscaQuery } from "./dto/busca.query";
import { BuscaService } from "./busca.service";

@ApiTags("busca")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("busca")
export class BuscaController {
  constructor(private readonly busca: BuscaService) {}

  @Get()
  @ApiOperation({
    summary: "Busca global (topbar) — fan-out por RBAC: fichas e/ou usuários",
  })
  buscar(@Query() query: BuscaQuery, @CurrentUser() user: AuthenticatedUser) {
    return this.busca.buscar(user, query.q ?? "");
  }
}
