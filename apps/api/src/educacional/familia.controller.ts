import {
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
import { FamiliaService } from "./familia.service";

/**
 * Portal da família — EXCLUSIVO do responsável (ownership por User.fichaCidadaId).
 * Nunca aceita fichaId do client; nunca vira rota pública.
 */
@ApiTags("familia")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PerfisGuard)
@Perfis(Perfil.RESPONSAVEL_FAMILIAR)
@Controller("familia/educacional")
export class FamiliaController {
  constructor(private readonly familia: FamiliaService) {}

  @Get("criancas")
  @ApiOperation({ summary: "Minhas crianças matriculadas (navegação do portal)" })
  criancas(@CurrentUser() user: AuthenticatedUser) {
    return this.familia.minhasCriancas(user);
  }

  @Get("diario/:membroId")
  @ApiOperation({ summary: "Diário FECHADO do dia (rotina de menor = dado sensível, audit READ)" })
  @ApiParam({ name: "membroId", description: "cuid da criança (da própria família)" })
  diario(
    @Param("membroId") membroId: string,
    @Query("data") data: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.familia.diario(user, membroId, data);
  }

  @Get("ficha/:membroId")
  @ApiOperation({ summary: "Ficha da criança: autorizados, alergias, autorizações de imagem" })
  @ApiParam({ name: "membroId", description: "cuid da criança (da própria família)" })
  ficha(@Param("membroId") membroId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.familia.fichaCrianca(user, membroId);
  }

  @Get("comunicados")
  @ApiOperation({ summary: "Comunicados das unidades das minhas crianças" })
  comunicados(@CurrentUser() user: AuthenticatedUser) {
    return this.familia.comunicados(user);
  }

  @Post("comunicados/:id/leitura")
  @ApiOperation({ summary: "Confirma leitura (obrigatória nos críticos) — idempotente" })
  @ApiParam({ name: "id", description: "cuid do comunicado" })
  @HttpCode(HttpStatus.OK)
  confirmarLeitura(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.familia.confirmarLeitura(user, id);
  }
}
