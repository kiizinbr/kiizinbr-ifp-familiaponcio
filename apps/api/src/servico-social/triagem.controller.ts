import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Perfil, PrioridadeTriagem, StatusTriagem } from "@ifp/database";

import { CurrentUser, type AuthenticatedUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Perfis } from "../auth/perfis.decorator";
import { PerfisGuard } from "../auth/perfis.guard";
import { TriagemService } from "./triagem.service";
import { CriarTriagemDto } from "./dto/criar-triagem.dto";

@ApiTags("servico-social")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PerfisGuard)
@Perfis(Perfil.SUPER_ADMIN, Perfil.SERVICO_SOCIAL)
@Controller("servico-social")
export class TriagemController {
  constructor(private readonly triagem: TriagemService) {}

  @Get("triagens")
  @ApiOperation({ summary: "Fila de triagem (KPIs + lista, URGENTE primeiro), filtros status/prioridade" })
  listar(
    @CurrentUser() user: AuthenticatedUser,
    @Query("status") status?: StatusTriagem,
    @Query("prioridade") prioridade?: PrioridadeTriagem,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query("perPage", new DefaultValuePipe(20), ParseIntPipe) perPage = 20,
  ) {
    return this.triagem.listar(user, { status, prioridade, page, perPage });
  }

  @Post("triagens")
  @ApiOperation({ summary: "Abre uma triagem (PENDENTE) para uma ficha" })
  criar(@Body() dto: CriarTriagemDto, @CurrentUser() user: AuthenticatedUser) {
    return this.triagem.criar(user, dto);
  }

  @Get("triagens/:id")
  @ApiOperation({ summary: "Detalhe de uma triagem" })
  detalhe(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.triagem.detalhe(user, id);
  }

  @Patch("triagens/:id/iniciar")
  @ApiOperation({ summary: "Inicia a triagem (PENDENTE -> EM_ANDAMENTO); 409 se não estiver pendente" })
  iniciar(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.triagem.iniciar(user, id);
  }

  @Patch("triagens/:id/concluir")
  @ApiOperation({ summary: "Conclui a triagem (EM_ANDAMENTO -> CONCLUIDA)" })
  concluir(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.triagem.concluir(user, id);
  }
}
