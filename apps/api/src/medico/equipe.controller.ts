import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { Perfil } from "@ifp/database";

import { CurrentUser, type AuthenticatedUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Perfis } from "../auth/perfis.decorator";
import { PerfisGuard } from "../auth/perfis.guard";
import { EquipeService } from "./equipe.service";
import { EditarProfissionalDto, VincularProfissionalDto } from "./dto/profissional.dto";

@ApiTags("medico")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PerfisGuard)
@Perfis(Perfil.SUPER_ADMIN, Perfil.GESTOR_UNIDADE)
@Controller("medico/equipe")
export class EquipeController {
  constructor(private readonly equipe: EquipeService) {}

  @Get()
  @ApiOperation({ summary: "Profissionais do Centro Médico" })
  listar(@CurrentUser() user: AuthenticatedUser) {
    return this.equipe.listar(user);
  }

  @Get("candidatos")
  @ApiOperation({ summary: "Usuários PROFISSIONAL da unidade ainda sem cadastro de profissional" })
  candidatos(@CurrentUser() user: AuthenticatedUser) {
    return this.equipe.candidatos(user);
  }

  @Post()
  @ApiOperation({ summary: "Vincula um usuário como profissional do Centro Médico" })
  vincular(@Body() dto: VincularProfissionalDto, @CurrentUser() user: AuthenticatedUser) {
    return this.equipe.vincular(user, dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Edita dados do profissional (especialidade, conselho, ativo)" })
  @ApiParam({ name: "id", description: "cuid do profissional" })
  editar(
    @Param("id") id: string,
    @Body() dto: EditarProfissionalDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.equipe.editar(user, id, dto);
  }
}
