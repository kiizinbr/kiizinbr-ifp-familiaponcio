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
import { Perfil, PrioridadeSinal, StatusSinalizacao } from "@ifp/database";

import { CurrentUser, type AuthenticatedUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Perfis } from "../auth/perfis.decorator";
import { PerfisGuard } from "../auth/perfis.guard";
import { PonteService } from "./ponte.service";
import { CriarSinalizacaoDto } from "./dto/criar-sinalizacao.dto";

@ApiTags("servico-social")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PerfisGuard)
@Perfis(Perfil.SUPER_ADMIN, Perfil.SERVICO_SOCIAL)
@Controller("servico-social")
export class PonteController {
  constructor(private readonly ponte: PonteService) {}

  @Get("ponte")
  @ApiOperation({ summary: "Sinalizações recebidas (PENDENTE primeiro), filtros status/prioridade" })
  listar(
    @CurrentUser() user: AuthenticatedUser,
    @Query("status") status?: StatusSinalizacao,
    @Query("prioridade") prioridade?: PrioridadeSinal,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query("perPage", new DefaultValuePipe(20), ParseIntPipe) perPage = 20,
  ) {
    return this.ponte.listar(user, { status, prioridade, page, perPage });
  }

  @Patch("ponte/:id/marcar-atendida")
  @ApiOperation({ summary: "Marca a sinalização como ATENDIDA; 409 se já atendida" })
  marcarAtendida(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.ponte.marcarAtendida(user, id);
  }

  // A criação é do PROFISSIONAL (médico/educador) — RBAC sobrescreve o da classe.
  @Post("ponte")
  @Perfis(Perfil.SUPER_ADMIN, Perfil.PROFISSIONAL, Perfil.GESTOR_UNIDADE)
  @ApiOperation({ summary: "Profissional sinaliza uma família ao Serviço Social" })
  criar(@Body() dto: CriarSinalizacaoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.ponte.criar(user, dto);
  }
}
