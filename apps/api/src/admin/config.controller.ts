import { Body, Controller, Get, Param, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { Perfil } from "@ifp/database";

import { CurrentUser, type AuthenticatedUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Perfis } from "../auth/perfis.decorator";
import { PerfisGuard } from "../auth/perfis.guard";
import { ConfigService } from "./config.service";
import { AtualizarParametroDto } from "./dto/atualizar-parametro.dto";

/**
 * Painel de Configuração da plataforma (A6) — SUPER_ADMIN apenas.
 * Lê a config (unidades, perfis, parâmetros) e ajusta parâmetros simples.
 * Toda alteração é auditada (LGPD) no service.
 */
@ApiTags("admin")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PerfisGuard)
@Perfis(Perfil.SUPER_ADMIN)
@Controller("admin/config")
export class ConfigController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  @ApiOperation({ summary: "Config da plataforma: unidades, perfis e parâmetros" })
  ler(@CurrentUser() user: AuthenticatedUser) {
    return this.config.lerConfig(user);
  }

  @Put("parametros/:chave")
  @ApiOperation({ summary: "Ajusta um parâmetro simples (persiste + auditoria)" })
  @ApiParam({ name: "chave", description: "chave do parâmetro (whitelist)" })
  atualizar(
    @Param("chave") chave: string,
    @Body() dto: AtualizarParametroDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.config.atualizarParametro(user, chave, dto.valor);
  }
}
