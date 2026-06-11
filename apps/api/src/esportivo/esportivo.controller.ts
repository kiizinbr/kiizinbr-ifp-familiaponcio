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
import { ConcederGraduacaoDto } from "./dto/conceder-graduacao.dto";
import { CriarMatriculaEsportivaDto } from "./dto/criar-matricula-esportiva.dto";
import { CriarTurmaEsportivaDto } from "./dto/criar-turma-esportiva.dto";
import { GraduacoesService } from "./graduacoes.service";
import { TurmasEsportivasService } from "./turmas-esportivas.service";

@ApiTags("esportivo")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PerfisGuard)
@Perfis(Perfil.SUPER_ADMIN, Perfil.PROFISSIONAL, Perfil.GESTOR_UNIDADE)
@Controller("esportivo")
export class EsportivoController {
  constructor(
    private readonly turmas: TurmasEsportivasService,
    private readonly graduacoes: GraduacoesService,
  ) {}

  @Get("turmas")
  @ApiOperation({ summary: "Turmas da unidade do profissional logado" })
  listar(@CurrentUser() user: AuthenticatedUser) {
    return this.turmas.listar(user);
  }

  @Get("modalidades")
  @ApiOperation({ summary: "Modalidades ativas da unidade (form de nova turma)" })
  modalidades(@CurrentUser() user: AuthenticatedUser) {
    return this.turmas.modalidades(user);
  }

  @Get("resumo")
  @ApiOperation({ summary: "KPIs da unidade (dashboard)" })
  resumo(@CurrentUser() user: AuthenticatedUser) {
    return this.turmas.resumo(user);
  }

  @Get("fichas-elegiveis")
  @ApiOperation({ summary: "Fichas APROVADAS no Esportivo (form de matrícula)" })
  fichasElegiveis(@Query("q") q: string, @CurrentUser() user: AuthenticatedUser) {
    return this.turmas.fichasElegiveis(user, q);
  }

  @Post("turmas")
  @ApiOperation({ summary: "Cria uma turma (instrutor logado vira o responsável)" })
  criar(@Body() dto: CriarTurmaEsportivaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.turmas.criar(user, dto);
  }

  @Post("turmas/:id/matriculas")
  @ApiOperation({
    summary: "Matricula um atleta (exige elegibilidade APROVADA; lotada → lista de espera)",
  })
  @ApiParam({ name: "id", description: "cuid da turma esportiva" })
  matricular(
    @Param("id") id: string,
    @Body() dto: CriarMatriculaEsportivaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.turmas.matricular(user, id, dto);
  }

  @Get("turmas/:id")
  @ApiOperation({ summary: "Detalhe da turma com atletas e graduações" })
  @ApiParam({ name: "id", description: "cuid da turma esportiva" })
  detalhe(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.turmas.detalhe(user, id);
  }

  @Post("turmas/:id/encerrar")
  @ApiOperation({
    summary: "Encerra a turma: ativas viram concluídas, espera não atendida é cancelada",
  })
  @ApiParam({ name: "id", description: "cuid da turma esportiva" })
  @HttpCode(HttpStatus.OK)
  encerrar(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.turmas.encerrar(user, id);
  }

  @Post("matriculas/:id/graduacoes")
  @ApiOperation({ summary: "Concede graduação da trilha da modalidade (audit obrigatório)" })
  @ApiParam({ name: "id", description: "cuid da matrícula esportiva" })
  conceder(
    @Param("id") id: string,
    @Body() dto: ConcederGraduacaoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.graduacoes.conceder(user, id, dto);
  }
}
