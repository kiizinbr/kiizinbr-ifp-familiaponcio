import { Body, Controller, Get, HttpCode, HttpStatus, Param, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { Perfil } from "@ifp/database";

import { CurrentUser, type AuthenticatedUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Perfis } from "../auth/perfis.decorator";
import { PerfisGuard } from "../auth/perfis.guard";
import { TriagemEnfermagemService } from "./triagem-enfermagem.service";
import { UpsertTriagemEnfermagemDto } from "./dto/upsert-triagem-enfermagem.dto";

@ApiTags("medico")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PerfisGuard)
@Perfis(Perfil.SUPER_ADMIN, Perfil.PROFISSIONAL)
@Controller("medico")
export class TriagemEnfermagemController {
  constructor(private readonly triagem: TriagemEnfermagemService) {}

  @Put("agendamentos/:agendamentoId/triagem-enfermagem")
  @ApiOperation({
    summary:
      "Enfermagem registra a triagem (vitais na chegada + classificação de risco). Exige chegada marcada.",
  })
  @ApiParam({ name: "agendamentoId", description: "cuid do agendamento" })
  @HttpCode(HttpStatus.OK)
  salvar(
    @Param("agendamentoId") agendamentoId: string,
    @Body() dto: UpsertTriagemEnfermagemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.triagem.salvar(user, agendamentoId, dto);
  }

  @Get("agendamentos/:agendamentoId/triagem-enfermagem")
  @ApiOperation({ summary: "Lê a triagem de enfermagem do agendamento (registra READ)" })
  @ApiParam({ name: "agendamentoId", description: "cuid do agendamento" })
  obter(
    @Param("agendamentoId") agendamentoId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.triagem.obter(user, agendamentoId);
  }
}
