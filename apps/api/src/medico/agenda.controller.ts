import { Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { Perfil } from "@ifp/database";

import { CurrentUser, type AuthenticatedUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Perfis } from "../auth/perfis.decorator";
import { PerfisGuard } from "../auth/perfis.guard";
import { AgendaService } from "./agenda.service";
import { ListAgendaQuery } from "./dto/list-agenda.query";

@ApiTags("medico")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PerfisGuard)
@Perfis(Perfil.SUPER_ADMIN, Perfil.PROFISSIONAL)
@Controller("medico")
export class AgendaController {
  constructor(private readonly agenda: AgendaService) {}

  @Get("agenda")
  @ApiOperation({ summary: "Agenda do dia do profissional logado" })
  listarDia(@Query() query: ListAgendaQuery, @CurrentUser() user: AuthenticatedUser) {
    return this.agenda.listarDia(user, query.data);
  }

  @Get("agenda/:agendamentoId")
  @ApiOperation({
    summary: "Payload completo da prancha (ficha + histórico clínico + draft) — registra READ",
  })
  @ApiParam({ name: "agendamentoId", description: "cuid do agendamento" })
  prancha(
    @Param("agendamentoId") agendamentoId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.agenda.prancha(user, agendamentoId);
  }

  @Post("agendamentos/:agendamentoId/iniciar")
  @ApiOperation({
    summary: "Inicia o atendimento do agendamento (idempotente) e marca EM_ATENDIMENTO",
  })
  @ApiParam({ name: "agendamentoId", description: "cuid do agendamento" })
  iniciar(
    @Param("agendamentoId") agendamentoId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.agenda.iniciar(user, agendamentoId);
  }
}
