import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { Perfil } from "@ifp/database";

import { CurrentUser, type AuthenticatedUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Perfis } from "../auth/perfis.decorator";
import { PerfisGuard } from "../auth/perfis.guard";
import { UnidadesService } from "./unidades.service";
import { CriarUnidadeDto } from "./dto/criar-unidade.dto";
import { EditarUnidadeDto } from "./dto/editar-unidade.dto";
import { DefinirUnidadeAtivaDto } from "./dto/definir-unidade-ativa.dto";

/** CRUD de unidades (tenants) — SUPER_ADMIN apenas. */
@ApiTags("admin")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PerfisGuard)
@Perfis(Perfil.SUPER_ADMIN)
@Controller("admin/unidades")
export class UnidadesController {
  constructor(private readonly unidades: UnidadesService) {}

  @Get()
  @ApiOperation({ summary: "Lista todas as unidades (com nº de usuários vinculados)" })
  listar(@CurrentUser() user: AuthenticatedUser) {
    return this.unidades.listar(user);
  }

  @Post()
  @ApiOperation({ summary: "Cria uma unidade (409 se o tipo/slug já existir)" })
  criar(@Body() dto: CriarUnidadeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.unidades.criar(user, dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Edita nome/contato da unidade (tipo e slug são imutáveis)" })
  @ApiParam({ name: "id", description: "cuid da unidade" })
  editar(
    @Param("id") id: string,
    @Body() dto: EditarUnidadeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.unidades.editar(user, id, dto);
  }

  @Patch(":id/ativo")
  @ApiOperation({ summary: "Ativa ou desativa a unidade (soft, nunca apaga)" })
  @ApiParam({ name: "id", description: "cuid da unidade" })
  definirAtivo(
    @Param("id") id: string,
    @Body() dto: DefinirUnidadeAtivaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.unidades.definirAtivo(user, id, dto.ativo);
  }
}
