import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Perfil } from "@ifp/database";

import { CurrentUser, type AuthenticatedUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Perfis } from "../auth/perfis.decorator";
import { PerfisGuard } from "../auth/perfis.guard";
import { SocialAgendaService } from "./social-agenda.service";

@ApiTags("servico-social")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PerfisGuard)
@Perfis(Perfil.SUPER_ADMIN, Perfil.SERVICO_SOCIAL)
@Controller("servico-social")
export class SocialAgendaController {
  constructor(private readonly agenda: SocialAgendaService) {}

  @Get("social-agenda")
  @ApiOperation({
    summary:
      "Agenda transversal do dia cruzando as 4 unidades (médico/capacitação/esportivo/educacional)",
  })
  doDia(@CurrentUser() user: AuthenticatedUser, @Query("data") data?: string) {
    return this.agenda.doDia(user, data);
  }
}
