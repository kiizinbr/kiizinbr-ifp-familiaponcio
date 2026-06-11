import {
  Body,
  Controller,
  Get,
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
import { CriarMatriculaInfantilDto } from "./dto/criar-matricula-infantil.dto";
import { CriarTurmaInfantilDto } from "./dto/criar-turma-infantil.dto";
import { TurmasInfantisService } from "./turmas-infantis.service";

@ApiTags("educacional")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PerfisGuard)
@Perfis(Perfil.SUPER_ADMIN, Perfil.GESTOR_UNIDADE, Perfil.PROFISSIONAL)
@Controller("educacional")
export class TurmasInfantisController {
  constructor(private readonly turmas: TurmasInfantisService) {}

  @Get("resumo")
  @ApiOperation({ summary: "KPIs do painel: presentes, diários, críticos sem leitura" })
  resumo(@CurrentUser() user: AuthenticatedUser) {
    return this.turmas.resumo(user);
  }

  @Get("turmas")
  @ApiOperation({ summary: "Turmas infantis da unidade" })
  listar(@CurrentUser() user: AuthenticatedUser) {
    return this.turmas.listar(user);
  }

  @Post("turmas")
  @Perfis(Perfil.SUPER_ADMIN, Perfil.GESTOR_UNIDADE)
  @ApiOperation({ summary: "Cria turma infantil (gestão)" })
  criar(@Body() dto: CriarTurmaInfantilDto, @CurrentUser() user: AuthenticatedUser) {
    return this.turmas.criar(user, dto);
  }

  @Get("turmas/:id")
  @ApiOperation({ summary: "Turma com crianças e estado do dia (check-in/presente/saiu)" })
  @ApiParam({ name: "id", description: "cuid da turma infantil" })
  detalhe(
    @Param("id") id: string,
    @Query("data") data: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.turmas.detalhe(user, id, data);
  }

  @Post("turmas/:id/matriculas")
  @Perfis(Perfil.SUPER_ADMIN, Perfil.GESTOR_UNIDADE)
  @ApiOperation({
    summary: "Matricula criança (exige elegibilidade + consentimento Art. 14; colhe autorização de imagem)",
  })
  @ApiParam({ name: "id", description: "cuid da turma infantil" })
  matricular(
    @Param("id") id: string,
    @Body() dto: CriarMatriculaInfantilDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.turmas.matricular(user, id, dto);
  }
}
