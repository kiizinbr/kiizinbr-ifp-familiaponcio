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
import { CriarRegistroRotinaDto } from "./dto/criar-registro-rotina.dto";
import { RegistrarCheckDto } from "./dto/registrar-check.dto";
import { RotinaService } from "./rotina.service";

@ApiTags("educacional")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PerfisGuard)
@Perfis(Perfil.SUPER_ADMIN, Perfil.GESTOR_UNIDADE, Perfil.PROFISSIONAL)
@Controller("educacional")
export class RotinaController {
  constructor(private readonly rotina: RotinaService) {}

  @Post("checkins")
  @ApiOperation({ summary: "Check-in: registra quem ENTREGOU a criança (valida autorizado)" })
  checkin(@Body() dto: RegistrarCheckDto, @CurrentUser() user: AuthenticatedUser) {
    return this.rotina.checkin(user, dto);
  }

  @Post("checkouts")
  @ApiOperation({
    summary:
      "Check-out: BLOQUEIA revogado/vencido/restrição judicial (403 + audit da tentativa); sem check-in → 409",
  })
  checkout(@Body() dto: RegistrarCheckDto, @CurrentUser() user: AuthenticatedUser) {
    return this.rotina.checkout(user, dto);
  }

  @Post("diarios/:membroId/registros")
  @ApiOperation({ summary: "Lançamento de rotina (5–10s); cria o diário do dia; FECHADO → 409" })
  @ApiParam({ name: "membroId", description: "cuid do MembroFamiliar (criança)" })
  registrar(
    @Param("membroId") membroId: string,
    @Body() dto: CriarRegistroRotinaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rotina.registrarRotina(user, membroId, dto);
  }

  @Get("diarios/:membroId")
  @ApiOperation({ summary: "Diário do dia da criança (visão do educador)" })
  @ApiParam({ name: "membroId", description: "cuid do MembroFamiliar (criança)" })
  diario(
    @Param("membroId") membroId: string,
    @Query("data") data: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rotina.diarioDoDia(user, membroId, data);
  }

  @Patch("diarios/:id/fechar")
  @ApiOperation({ summary: "Sela o diário — só então visível à família" })
  @ApiParam({ name: "id", description: "cuid do DiarioDia" })
  @HttpCode(HttpStatus.OK)
  fechar(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.rotina.fecharDiario(user, id);
  }
}
