import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseBoolPipe,
  ParseIntPipe,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Perfil } from "@ifp/database";

import { CurrentUser, type AuthenticatedUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Perfis } from "../auth/perfis.decorator";
import { PerfisGuard } from "../auth/perfis.guard";
import { ComunicadosEntregaService } from "./comunicados-entrega.service";

/** Entrega/leitura de comunicados (visão transversal) — SUPER_ADMIN apenas. */
@ApiTags("admin")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PerfisGuard)
@Perfis(Perfil.SUPER_ADMIN)
@Controller("admin/comunicados/entrega")
export class ComunicadosEntregaController {
  constructor(private readonly entrega: ComunicadosEntregaService) {}

  @Get()
  @ApiOperation({ summary: "Cobertura de leitura por comunicado (filtros unidade/críticos)" })
  listar(
    @CurrentUser() user: AuthenticatedUser,
    @Query("unidade") unidadeSlug?: string,
    @Query("criticos", new DefaultValuePipe(false), ParseBoolPipe) apenasCriticos = false,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query("perPage", new DefaultValuePipe(20), ParseIntPipe) perPage = 20,
  ) {
    return this.entrega.listar(user, { unidadeSlug, apenasCriticos, page, perPage });
  }
}
