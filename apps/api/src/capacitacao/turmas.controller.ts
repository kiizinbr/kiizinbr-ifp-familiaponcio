import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
import { AlterarMatriculaDto } from "./dto/alterar-matricula.dto";
import { CriarMatriculaDto } from "./dto/criar-matricula.dto";
import { CriarTurmaDto } from "./dto/criar-turma.dto";
import { EditarTurmaDto } from "./dto/editar-turma.dto";
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

  @Get("cursos")
  @ApiOperation({ summary: "Cursos ativos da unidade (form de nova turma)" })
  cursos(@CurrentUser() user: AuthenticatedUser) {
    return this.turmas.cursos(user);
  }

  @Get("resumo")
  @ApiOperation({ summary: "KPIs da unidade (dashboard)" })
  resumo(@CurrentUser() user: AuthenticatedUser) {
    return this.turmas.resumo(user);
  }

  @Get("fichas-elegiveis")
  @ApiOperation({ summary: "Fichas APROVADAS na Capacitação (form de matrícula)" })
  fichasElegiveis(@Query("q") q: string, @CurrentUser() user: AuthenticatedUser) {
    return this.turmas.fichasElegiveis(user, q);
  }

  @Get("certificados")
  @ApiOperation({ summary: "Certificados emitidos na unidade (consulta/2ª via)" })
  certificados(@CurrentUser() user: AuthenticatedUser) {
    return this.turmas.certificados(user);
  }

  @Patch("matriculas/:id")
  @ApiOperation({ summary: "Tranca, cancela ou reativa uma matrícula" })
  @ApiParam({ name: "id", description: "cuid da matrícula" })
  alterarMatricula(
    @Param("id") id: string,
    @Body() dto: AlterarMatriculaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.turmas.alterarMatricula(user, id, dto.status);
  }

  @Post("turmas")
  @ApiOperation({ summary: "Cria uma turma (instrutor logado vira o responsável)" })
  criar(@Body() dto: CriarTurmaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.turmas.criar(user, dto);
  }

  @Post("turmas/:id/matriculas")
  @ApiOperation({
    summary: "Matricula um aluno (exige elegibilidade APROVADA; lotada → lista de espera)",
  })
  @ApiParam({ name: "id", description: "cuid da turma" })
  matricular(
    @Param("id") id: string,
    @Body() dto: CriarMatriculaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.turmas.matricular(user, id, dto);
  }

  @Get("turmas/:id")
  @ApiOperation({ summary: "Detalhe da turma com alunos e % de presença" })
  @ApiParam({ name: "id", description: "cuid da turma" })
  detalhe(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.turmas.detalhe(user, id);
  }

  @Patch("turmas/:id")
  @ApiOperation({ summary: "Edita horário, sala ou vagas da turma" })
  @ApiParam({ name: "id", description: "cuid da turma" })
  editar(
    @Param("id") id: string,
    @Body() dto: EditarTurmaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.turmas.editar(user, id, dto);
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
