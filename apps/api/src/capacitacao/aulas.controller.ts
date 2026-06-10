import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { Perfil } from "@ifp/database";

import { CurrentUser, type AuthenticatedUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Perfis } from "../auth/perfis.decorator";
import { PerfisGuard } from "../auth/perfis.guard";
import { AulasService } from "./aulas.service";
import { CriarAulaDto } from "./dto/criar-aula.dto";
import { LancarChamadaDto } from "./dto/lancar-chamada.dto";

@ApiTags("capacitacao")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PerfisGuard)
@Perfis(Perfil.SUPER_ADMIN, Perfil.PROFISSIONAL, Perfil.GESTOR_UNIDADE)
@Controller("capacitacao")
export class AulasController {
  constructor(private readonly aulas: AulasService) {}

  @Get("aulas/:id")
  @ApiOperation({ summary: "Aula com presenças lançadas (hidrata a chamada)" })
  @ApiParam({ name: "id", description: "cuid da aula" })
  detalhe(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.aulas.detalhe(user, id);
  }

  @Post("turmas/:turmaId/aulas")
  @ApiOperation({ summary: "Cria a aula do dia (instrutor da turma)" })
  @ApiParam({ name: "turmaId", description: "cuid da turma" })
  criar(
    @Param("turmaId") turmaId: string,
    @Body() dto: CriarAulaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.aulas.criar(user, turmaId, dto);
  }

  @Put("aulas/:id/chamada")
  @ApiOperation({ summary: "Lança a chamada em lote (idempotente; 409 após o selo)" })
  @ApiParam({ name: "id", description: "cuid da aula" })
  @HttpCode(HttpStatus.OK)
  lancarChamada(
    @Param("id") id: string,
    @Body() dto: LancarChamadaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.aulas.lancarChamada(user, id, dto);
  }

  @Post("aulas/:id/encerrar")
  @ApiOperation({ summary: "Sela a aula (chamada vira imutável)" })
  @ApiParam({ name: "id", description: "cuid da aula" })
  @HttpCode(HttpStatus.OK)
  encerrar(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.aulas.encerrar(user, id);
  }
}
