import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { Perfil, StatusSessaoPratica } from "@ifp/database";

import { CurrentUser, type AuthenticatedUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Perfis } from "../auth/perfis.decorator";
import { PerfisGuard } from "../auth/perfis.guard";
import { BancoModelosService } from "./banco-modelos.service";
import { CriarModeloVoluntarioDto } from "./dto/criar-modelo-voluntario.dto";
import { CriarSessaoPraticaDto } from "./dto/criar-sessao-pratica.dto";
import { InscreverModeloDto } from "./dto/inscrever-modelo.dto";
import { VincularAlunoModeloDto } from "./dto/vincular-aluno-modelo.dto";

/**
 * Banco de Modelos da Capacitação (C4): voluntários da comunidade + agenda de
 * sessões práticas + matching aluno <-> modelo. Mesma parede de RBAC das outras
 * telas da Capacitação (instrutor/gestor/super admin).
 */
@ApiTags("capacitacao")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PerfisGuard)
@Perfis(Perfil.SUPER_ADMIN, Perfil.PROFISSIONAL, Perfil.GESTOR_UNIDADE)
@Controller("capacitacao/banco-modelos")
export class BancoModelosController {
  constructor(private readonly banco: BancoModelosService) {}

  // ---- Modelos voluntários ----

  @Get("modelos")
  @ApiOperation({ summary: "Modelos voluntários da unidade" })
  @ApiQuery({ name: "incluirInativos", required: false })
  listarModelos(
    @CurrentUser() user: AuthenticatedUser,
    @Query("incluirInativos") incluirInativos?: string,
  ) {
    return this.banco.listarModelos(user, incluirInativos === "true");
  }

  @Post("modelos")
  @ApiOperation({ summary: "Cadastra um modelo voluntário da comunidade" })
  criarModelo(
    @Body() dto: CriarModeloVoluntarioDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.banco.criarModelo(user, dto);
  }

  // ---- Sessões práticas ----

  @Get("sessoes")
  @ApiOperation({ summary: "Sessões práticas da unidade (filtros turma/status)" })
  @ApiQuery({ name: "turmaId", required: false })
  @ApiQuery({ name: "status", required: false, enum: StatusSessaoPratica })
  listarSessoes(
    @CurrentUser() user: AuthenticatedUser,
    @Query("turmaId") turmaId?: string,
    @Query("status") status?: string,
  ) {
    return this.banco.listarSessoes(user, { turmaId, status });
  }

  @Post("sessoes")
  @ApiOperation({ summary: "Cria uma sessão prática para uma turma" })
  criarSessao(
    @Body() dto: CriarSessaoPraticaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.banco.criarSessao(user, dto);
  }

  @Get("sessoes/:id")
  @ApiOperation({ summary: "Detalhe da sessão prática (inscrições + matching)" })
  @ApiParam({ name: "id", description: "cuid da sessão" })
  detalheSessao(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.banco.detalheSessao(user, id);
  }

  // ---- Matching ----

  @Post("sessoes/:id/inscricoes")
  @ApiOperation({ summary: "Inscreve um modelo voluntário na sessão (opcional: já vincula aluno)" })
  @ApiParam({ name: "id", description: "cuid da sessão" })
  inscreverModelo(
    @Param("id") id: string,
    @Body() dto: InscreverModeloDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.banco.inscreverModelo(user, id, dto);
  }

  @Patch("inscricoes/:id/aluno")
  @ApiOperation({ summary: "Vincula (ou troca) o aluno designado de uma inscrição" })
  @ApiParam({ name: "id", description: "cuid da inscrição" })
  vincularAluno(
    @Param("id") id: string,
    @Body() dto: VincularAlunoModeloDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.banco.vincularAluno(user, id, dto.matriculaId);
  }
}
