import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { Perfil } from "@ifp/database";

import { CurrentUser, type AuthenticatedUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Perfis } from "../auth/perfis.decorator";
import { PerfisGuard } from "../auth/perfis.guard";
import { AgendaService } from "./agenda.service";
import { AtualizarAgendamentoDto } from "./dto/atualizar-agendamento.dto";
import { CriarAgendamentoDto } from "./dto/criar-agendamento.dto";
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

  @Get("fila")
  @Perfis(Perfil.SUPER_ADMIN, Perfil.PROFISSIONAL, Perfil.GESTOR_UNIDADE, Perfil.RECEPCAO)
  @ApiOperation({ summary: "Fila do dia da unidade (todos os profissionais) — balcão/recepção" })
  fila(@Query() query: ListAgendaQuery, @CurrentUser() user: AuthenticatedUser) {
    return this.agenda.filaUnidade(user, query.data);
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

  @Get("fichas")
  @ApiOperation({ summary: "Busca enxuta de pacientes para agendar (mín. 2 caracteres)" })
  buscarFichas(@Query("q") q: string, @CurrentUser() user: AuthenticatedUser) {
    return this.agenda.buscarFichas(user, q);
  }

  @Post("agendamentos")
  @ApiOperation({ summary: "Cria um agendamento para o profissional logado" })
  criarAgendamento(
    @Body() dto: CriarAgendamentoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.agenda.criarAgendamento(user, dto);
  }

  @Patch("agendamentos/:agendamentoId")
  @Perfis(Perfil.SUPER_ADMIN, Perfil.PROFISSIONAL, Perfil.GESTOR_UNIDADE, Perfil.RECEPCAO)
  @ApiOperation({ summary: "Confirma, marca falta, cancela ou reagenda um agendamento" })
  @ApiParam({ name: "agendamentoId", description: "cuid do agendamento" })
  atualizarAgendamento(
    @Param("agendamentoId") agendamentoId: string,
    @Body() dto: AtualizarAgendamentoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.agenda.atualizarAgendamento(user, agendamentoId, dto);
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
