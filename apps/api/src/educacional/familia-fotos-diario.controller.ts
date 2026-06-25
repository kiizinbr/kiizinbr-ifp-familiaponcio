import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { Perfil } from "@ifp/database";

import { CurrentUser, type AuthenticatedUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Perfis } from "../auth/perfis.decorator";
import { PerfisGuard } from "../auth/perfis.guard";
import { FotosDiarioService } from "./fotos-diario.service";

/**
 * Fotos do diário da creche — lado FAMÍLIA (Onda C3).
 *
 * EXCLUSIVO do responsável (ownership por User.fichaCidadaId; nunca aceita
 * fichaId do client). Só fotos de diário FECHADO (selo) da PRÓPRIA criança.
 *
 * Ordem das rotas: a estática `diario/fotos/:fotoId/download` é declarada ANTES
 * da paramétrica `diario/:membroId/fotos` para não haver ambiguidade de match.
 */
@ApiTags("familia")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PerfisGuard)
@Perfis(Perfil.RESPONSAVEL_FAMILIAR)
@Controller("familia/educacional/diario")
export class FamiliaFotosDiarioController {
  constructor(private readonly fotos: FotosDiarioService) {}

  @Get("fotos/:fotoId/download")
  @ApiOperation({
    summary: "URL pré-assinada da foto da PRÓPRIA criança (diário FECHADO; checa ownership)",
  })
  @ApiParam({ name: "fotoId", description: "cuid da FotoDiario" })
  download(@Param("fotoId") fotoId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.fotos.downloadFamilia(user, fotoId);
  }

  @Get(":membroId/fotos")
  @ApiOperation({ summary: "Fotos do diário FECHADO do dia da própria criança (audit READ)" })
  @ApiParam({ name: "membroId", description: "cuid da criança (da própria família)" })
  listar(
    @Param("membroId") membroId: string,
    @Query("data") data: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.fotos.listarFamilia(user, membroId, data);
  }
}
