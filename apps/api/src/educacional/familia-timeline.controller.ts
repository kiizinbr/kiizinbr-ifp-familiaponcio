import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { Perfil } from "@ifp/database";

import { CurrentUser, type AuthenticatedUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Perfis } from "../auth/perfis.decorator";
import { PerfisGuard } from "../auth/perfis.guard";
import { FamiliaTimelineService } from "./familia-timeline.service";

/**
 * Portal da família — linha do tempo da criança. EXCLUSIVO do responsável
 * (ownership por User.fichaCidadaId). A criança (membroId) é sempre conferida
 * contra a própria família antes de agregar (IDOR → 403). Nunca rota pública.
 */
@ApiTags("familia")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PerfisGuard)
@Perfis(Perfil.RESPONSAVEL_FAMILIAR)
@Controller("familia/educacional")
export class FamiliaTimelineController {
  constructor(private readonly timeline: FamiliaTimelineService) {}

  @Get("timeline/:membroId")
  @ApiOperation({
    summary:
      "Linha do tempo da criança: jornada cronológica cruzando as verticais (read agregado)",
  })
  @ApiParam({ name: "membroId", description: "cuid da criança (da própria família)" })
  timelineCrianca(
    @Param("membroId") membroId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.timeline.timeline(user, membroId);
  }
}
