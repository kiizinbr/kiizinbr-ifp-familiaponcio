import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Perfil } from "@ifp/database";

import { CurrentUser, type AuthenticatedUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Perfis } from "../auth/perfis.decorator";
import { PerfisGuard } from "../auth/perfis.guard";
import { ComunicadosService } from "./comunicados.service";
import { CriarComunicadoDto } from "./dto/criar-comunicado.dto";

@ApiTags("educacional")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PerfisGuard)
@Perfis(Perfil.SUPER_ADMIN, Perfil.GESTOR_UNIDADE)
@Controller("educacional/comunicados")
export class ComunicadosController {
  constructor(private readonly comunicados: ComunicadosService) {}

  @Get()
  @Perfis(Perfil.SUPER_ADMIN, Perfil.GESTOR_UNIDADE, Perfil.PROFISSIONAL)
  @ApiOperation({ summary: "Comunicados da unidade com contagem de leituras" })
  listar(@CurrentUser() user: AuthenticatedUser) {
    return this.comunicados.listar(user);
  }

  @Post()
  @ApiOperation({ summary: "Publica comunicado (crítico exige confirmação de leitura)" })
  criar(@Body() dto: CriarComunicadoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.comunicados.criar(user, dto);
  }
}
