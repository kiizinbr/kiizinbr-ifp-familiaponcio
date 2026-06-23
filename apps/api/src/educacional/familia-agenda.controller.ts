import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { Perfil } from "@ifp/database";

import { CurrentUser, type AuthenticatedUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Perfis } from "../auth/perfis.decorator";
import { PerfisGuard } from "../auth/perfis.guard";
import { FamiliaAgendaService } from "./familia-agenda.service";
import { ResponderEventoDto } from "./dto/responder-evento.dto";
import { ResponderPresencaDto } from "./dto/responder-presenca.dto";

/**
 * Portal da família — agenda de eventos (calendário + confirmar presença) e o
 * "vem amanhã?" da creche. EXCLUSIVO do responsável (ownership por
 * User.fichaCidadaId). Nunca aceita fichaId do client; cada criança/evento é
 * conferido contra a própria família (IDOR).
 */
@ApiTags("familia")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PerfisGuard)
@Perfis(Perfil.RESPONSAVEL_FAMILIAR)
@Controller("familia")
export class FamiliaAgendaController {
  constructor(private readonly agenda: FamiliaAgendaService) {}

  @Get("agenda")
  @ApiOperation({ summary: "Calendário de eventos das unidades das minhas crianças + meu RSVP" })
  listarAgenda(@CurrentUser() user: AuthenticatedUser) {
    return this.agenda.agenda(user);
  }

  @Post("agenda/:eventoId/confirmar")
  @ApiOperation({ summary: "Confirma (SIM/NAO) a presença de uma criança da minha família no evento" })
  @ApiParam({ name: "eventoId", description: "cuid do evento" })
  @HttpCode(HttpStatus.OK)
  confirmarEvento(
    @Param("eventoId") eventoId: string,
    @Body() dto: ResponderEventoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.agenda.responderEvento(user, eventoId, dto);
  }

  @Get("presenca")
  @ApiOperation({ summary: "\"Vem amanhã?\" da creche — confirmação por criança no dia (default: amanhã)" })
  presencaDoDia(
    @Query("data") data: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.agenda.presencaDoDia(user, data);
  }

  @Post("presenca")
  @ApiOperation({ summary: "Responde o \"vem amanhã?\" de uma criança da minha família (SIM/NAO)" })
  @HttpCode(HttpStatus.OK)
  responderPresenca(
    @Body() dto: ResponderPresencaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.agenda.responderPresenca(user, dto);
  }
}
