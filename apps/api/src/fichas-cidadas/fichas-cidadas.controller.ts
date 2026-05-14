import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { Perfil } from "@ifp/database";

import { CurrentUser, type AuthenticatedUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Perfis } from "../auth/perfis.decorator";
import { PerfisGuard } from "../auth/perfis.guard";
import { CreateFichaCidadaDto } from "./dto/create-ficha-cidada.dto";
import { ListFichasQuery } from "./dto/list-fichas.query";
import { ReplaceMembrosDto } from "./dto/replace-membros.dto";
import { UpdateElegibilidadeDto } from "./dto/update-elegibilidade.dto";
import { UpdateFichaCidadaDto } from "./dto/update-ficha-cidada.dto";
import { UpsertDadosSocioDto } from "./dto/upsert-dados-socio.dto";
import { FichasCidadasService } from "./fichas-cidadas.service";

@ApiTags("fichas-cidadas")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PerfisGuard)
@Perfis(Perfil.SUPER_ADMIN, Perfil.SERVICO_SOCIAL)
@Controller("fichas-cidadas")
export class FichasCidadasController {
  constructor(private readonly fichas: FichasCidadasService) {}

  @Post()
  @ApiOperation({ summary: "Cria nova Ficha Cidadã (titular + endereço + contato)" })
  create(@Body() dto: CreateFichaCidadaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.fichas.create(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: "Lista fichas com filtros e paginação" })
  list(@Query() query: ListFichasQuery) {
    return this.fichas.findAll(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Detalha uma Ficha Cidadã (registra READ no audit log)" })
  @ApiParam({ name: "id", description: "cuid da ficha" })
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.fichas.findOne(id, user.id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Atualiza dados do titular" })
  update(
    @Param("id") id: string,
    @Body() dto: UpdateFichaCidadaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.fichas.update(id, dto, user.id);
  }

  @Put(":id/membros")
  @ApiOperation({ summary: "Substitui a composição familiar da ficha" })
  @HttpCode(HttpStatus.OK)
  replaceMembros(
    @Param("id") id: string,
    @Body() dto: ReplaceMembrosDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.fichas.replaceMembros(id, dto, user.id);
  }

  @Put(":id/dados-socio")
  @ApiOperation({ summary: "Cria ou atualiza os dados socioeconômicos da ficha" })
  @HttpCode(HttpStatus.OK)
  upsertDadosSocio(
    @Param("id") id: string,
    @Body() dto: UpsertDadosSocioDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.fichas.upsertDadosSocio(id, dto, user.id);
  }

  @Put(":id/elegibilidade/:unidadeSlug")
  @ApiOperation({
    summary: "Define o status de elegibilidade da ficha numa unidade específica",
  })
  @ApiParam({ name: "unidadeSlug", enum: ["medico", "capacitacao", "esportivo", "educacional"] })
  @HttpCode(HttpStatus.OK)
  updateElegibilidade(
    @Param("id") id: string,
    @Param("unidadeSlug") unidadeSlug: string,
    @Body() dto: UpdateElegibilidadeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.fichas.updateElegibilidade(id, unidadeSlug, dto, user.id);
  }
}
