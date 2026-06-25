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
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { BadRequestException } from "@nestjs/common";
import { Perfil, StatusMatricula, StatusTurma } from "@ifp/database";

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
  @ApiOperation({
    summary: "Turmas da unidade (filtros status/curso) com % de ocupação por turma",
  })
  @ApiQuery({ name: "status", required: false, enum: StatusTurma })
  @ApiQuery({ name: "cursoId", required: false })
  listar(
    @CurrentUser() user: AuthenticatedUser,
    @Query("status") status?: string,
    @Query("cursoId") cursoId?: string,
  ) {
    return this.turmas.listar(user, { status, cursoId });
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

  @Get("indicadores")
  @ApiOperation({ summary: "Indicadores da unidade (turmas/alunos por status, conclusão)" })
  indicadores(@CurrentUser() user: AuthenticatedUser) {
    return this.turmas.indicadores(user);
  }

  @Get("indicadores/series")
  @ApiOperation({
    summary:
      "Séries temporais por mês (matrículas/conclusões/certificados/evasão) da unidade — últimos N meses",
  })
  @ApiQuery({ name: "meses", required: false, description: "3 a 24 (default 12)" })
  indicadoresSeries(
    @CurrentUser() user: AuthenticatedUser,
    @Query("meses") meses?: string,
  ) {
    return this.turmas.indicadoresSeries(user, meses);
  }

  @Get("fichas-elegiveis")
  @ApiOperation({ summary: "Fichas APROVADAS na Capacitação (form de matrícula)" })
  fichasElegiveis(@Query("q") q: string, @CurrentUser() user: AuthenticatedUser) {
    return this.turmas.fichasElegiveis(user, q);
  }

  @Get("certificados")
  @ApiOperation({
    summary:
      "Certificados emitidos na unidade (consulta/2ª via). Filtros: busca (aluno/código/curso), curso e período",
  })
  @ApiQuery({ name: "q", required: false, description: "Busca por aluno, código ou curso" })
  @ApiQuery({ name: "cursoId", required: false })
  @ApiQuery({ name: "de", required: false, description: "Emitido a partir de (YYYY-MM-DD)" })
  @ApiQuery({ name: "ate", required: false, description: "Emitido até (YYYY-MM-DD)" })
  certificados(
    @CurrentUser() user: AuthenticatedUser,
    @Query("q") q?: string,
    @Query("cursoId") cursoId?: string,
    @Query("de") de?: string,
    @Query("ate") ate?: string,
  ) {
    return this.turmas.certificados(user, { q, cursoId, de, ate });
  }

  @Get("matriculas/semestre")
  @ApiOperation({
    summary:
      "Matrículas consolidadas da unidade, agrupadas por turma. Filtros: status, busca (aluno/protocolo) e curso",
  })
  @ApiQuery({ name: "status", required: false, enum: StatusMatricula })
  @ApiQuery({ name: "q", required: false, description: "Busca por aluno ou protocolo" })
  @ApiQuery({ name: "cursoId", required: false })
  matriculasSemestre(
    @CurrentUser() user: AuthenticatedUser,
    @Query("status") status?: string,
    @Query("q") q?: string,
    @Query("cursoId") cursoId?: string,
  ) {
    let filtro: StatusMatricula | undefined;
    if (status) {
      if (!(Object.values(StatusMatricula) as string[]).includes(status)) {
        throw new BadRequestException("status inválido");
      }
      filtro = status as StatusMatricula;
    }
    return this.turmas.matriculasSemestre(user, filtro, { q, cursoId });
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
