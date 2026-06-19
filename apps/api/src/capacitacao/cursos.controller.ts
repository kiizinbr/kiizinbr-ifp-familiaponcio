import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { Perfil } from "@ifp/database";

import { CurrentUser, type AuthenticatedUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Perfis } from "../auth/perfis.decorator";
import { PerfisGuard } from "../auth/perfis.guard";
import { CursosService } from "./cursos.service";
import { AtualizarCursoDto } from "./dto/atualizar-curso.dto";
import { CriarCursoDto } from "./dto/criar-curso.dto";

@ApiTags("capacitacao")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PerfisGuard)
@Perfis(Perfil.SUPER_ADMIN, Perfil.GESTOR_UNIDADE, Perfil.PROFISSIONAL)
@Controller("capacitacao/cursos")
export class CursosController {
  constructor(private readonly cursos: CursosService) {}

  @Get("todos")
  @ApiOperation({ summary: "Todos os cursos da unidade (gestão), com nº de turmas" })
  listarTodos(@CurrentUser() user: AuthenticatedUser) {
    return this.cursos.listarTodos(user);
  }

  @Post()
  @ApiOperation({ summary: "Cria um curso na unidade do profissional logado" })
  criar(@Body() dto: CriarCursoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.cursos.criar(user, dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Edita um curso (inclui ativar/desativar)" })
  @ApiParam({ name: "id", description: "cuid do curso" })
  atualizar(
    @Param("id") id: string,
    @Body() dto: AtualizarCursoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cursos.atualizar(user, id, dto);
  }
}
