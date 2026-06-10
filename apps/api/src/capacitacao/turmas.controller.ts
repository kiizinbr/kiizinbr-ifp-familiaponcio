import { Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { Perfil } from "@ifp/database";

import { CurrentUser, type AuthenticatedUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Perfis } from "../auth/perfis.decorator";
import { PerfisGuard } from "../auth/perfis.guard";
import { TurmasService } from "./turmas.service";

@ApiTags("capacitacao")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PerfisGuard)
@Perfis(Perfil.SUPER_ADMIN, Perfil.PROFISSIONAL, Perfil.GESTOR_UNIDADE)
@Controller("capacitacao")
export class TurmasController {
  constructor(private readonly turmas: TurmasService) {}

  @Get("turmas")
  @ApiOperation({ summary: "Turmas da unidade do profissional logado" })
  listar(@CurrentUser() user: AuthenticatedUser) {
    return this.turmas.listar(user);
  }

  @Get("turmas/:id")
  @ApiOperation({ summary: "Detalhe da turma com alunos e % de presença" })
  @ApiParam({ name: "id", description: "cuid da turma" })
  detalhe(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.turmas.detalhe(user, id);
  }

  @Post("turmas/:id/encerrar")
  @ApiOperation({
    summary: "Encerra a turma: certifica quem atingiu a presença mínima e marca evasões",
  })
  @ApiParam({ name: "id", description: "cuid da turma" })
  @HttpCode(HttpStatus.OK)
  encerrar(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.turmas.encerrar(user, id);
  }
}
