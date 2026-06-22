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
import { Perfil, PrioridadeSinal, StatusEncaminhamento } from "@ifp/database";

import { CurrentUser, type AuthenticatedUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Perfis } from "../auth/perfis.decorator";
import { PerfisGuard } from "../auth/perfis.guard";
import { EncaminhamentosService } from "./encaminhamentos.service";
import { CriarEncaminhamentoDto } from "./dto/criar-encaminhamento.dto";
import { RecusarEncaminhamentoDto } from "./dto/recusar-encaminhamento.dto";

@ApiTags("servico-social")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PerfisGuard)
@Perfis(Perfil.SUPER_ADMIN, Perfil.SERVICO_SOCIAL)
@Controller("servico-social")
export class EncaminhamentosController {
  constructor(private readonly encaminhamentos: EncaminhamentosService) {}

  @Get("encaminhamentos")
  @ApiOperation({ summary: "Lista encaminhamentos (KPIs + lista, URGENTE primeiro), filtros status/prioridade" })
  listar(
    @CurrentUser() user: AuthenticatedUser,
    @Query("status") status?: StatusEncaminhamento,
    @Query("prioridade") prioridade?: PrioridadeSinal,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query("perPage", new DefaultValuePipe(20), ParseIntPipe) perPage = 20,
  ) {
    return this.encaminhamentos.listar(user, { status, prioridade, page, perPage });
  }

  @Post("encaminhamentos")
  @ApiOperation({ summary: "Cria um encaminhamento de uma unidade para outra (família aprovada na origem)" })
  criar(@Body() dto: CriarEncaminhamentoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.encaminhamentos.criar(user, dto);
  }

  @Patch("encaminhamentos/:id/aceitar")
  @ApiOperation({ summary: "Aceita o encaminhamento (PENDENTE -> ACEITO); 409 se já respondido" })
  aceitar(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.encaminhamentos.aceitar(user, id);
  }

  @Patch("encaminhamentos/:id/recusar")
  @ApiOperation({ summary: "Recusa o encaminhamento (exige justificativa); 409 se já respondido" })
  recusar(
    @Param("id") id: string,
    @Body() dto: RecusarEncaminhamentoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.encaminhamentos.recusar(user, id, dto);
  }

  @Get("encaminhamentos/:fichaId/historico")
  @ApiOperation({ summary: "Timeline de encaminhamentos de uma ficha" })
  historico(@Param("fichaId") fichaId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.encaminhamentos.historico(user, fichaId);
  }
}
