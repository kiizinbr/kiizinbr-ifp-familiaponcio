import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Perfil } from "@ifp/database";

import { CurrentUser, type AuthenticatedUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Perfis } from "../auth/perfis.decorator";
import { PerfisGuard } from "../auth/perfis.guard";
import { IndicadoresService } from "./indicadores.service";

@ApiTags("educacional")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PerfisGuard)
@Perfis(Perfil.SUPER_ADMIN, Perfil.GESTOR_UNIDADE, Perfil.PROFISSIONAL)
@Controller("educacional")
export class IndicadoresController {
  constructor(private readonly indicadores: IndicadoresService) {}

  @Get("indicadores")
  @ApiOperation({
    summary: "Indicadores da creche: presença (7 dias), fechamento de diários e ocupação por turma",
  })
  obter(@CurrentUser() user: AuthenticatedUser) {
    return this.indicadores.indicadores(user);
  }
}
