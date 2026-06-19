import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { Perfil } from "@ifp/database";

import { CurrentUser, type AuthenticatedUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Perfis } from "../auth/perfis.decorator";
import { PerfisGuard } from "../auth/perfis.guard";
import { BeneficiariosService } from "./beneficiarios.service";
import { AtualizarAlergiaDto, RegistrarAlergiaDto } from "./dto/alergia.dto";
import { AtualizarCondicaoDto, RegistrarCondicaoDto } from "./dto/condicao.dto";

@ApiTags("medico")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PerfisGuard)
@Perfis(Perfil.SUPER_ADMIN, Perfil.PROFISSIONAL)
@Controller("medico")
export class BeneficiariosController {
  constructor(private readonly beneficiarios: BeneficiariosService) {}

  @Get("beneficiarios")
  @ApiOperation({ summary: "Beneficiários elegíveis no médico (busca opcional ?q=)" })
  listar(@Query("q") q: string, @CurrentUser() user: AuthenticatedUser) {
    return this.beneficiarios.listar(user, q);
  }

  @Get("prontuarios")
  @ApiOperation({ summary: "Atendimentos selados do profissional logado" })
  prontuarios(@CurrentUser() user: AuthenticatedUser) {
    return this.beneficiarios.prontuarios(user);
  }

  @Get("beneficiarios/:fichaId")
  @ApiOperation({ summary: "Ficha clínica: alergias, condições e histórico de atendimentos" })
  @ApiParam({ name: "fichaId", description: "cuid da ficha" })
  fichaClinica(@Param("fichaId") fichaId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.beneficiarios.fichaClinica(user, fichaId);
  }

  @Post("beneficiarios/:fichaId/alergias")
  @ApiOperation({ summary: "Registra uma alergia na ficha" })
  @ApiParam({ name: "fichaId", description: "cuid da ficha" })
  adicionarAlergia(
    @Param("fichaId") fichaId: string,
    @Body() dto: RegistrarAlergiaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.beneficiarios.adicionarAlergia(user, fichaId, dto);
  }

  @Patch("alergias/:id")
  @ApiOperation({ summary: "Edita ou inativa uma alergia" })
  @ApiParam({ name: "id", description: "cuid da alergia" })
  atualizarAlergia(
    @Param("id") id: string,
    @Body() dto: AtualizarAlergiaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.beneficiarios.atualizarAlergia(user, id, dto);
  }

  @Post("beneficiarios/:fichaId/condicoes")
  @ApiOperation({ summary: "Registra uma condição crônica na ficha" })
  @ApiParam({ name: "fichaId", description: "cuid da ficha" })
  adicionarCondicao(
    @Param("fichaId") fichaId: string,
    @Body() dto: RegistrarCondicaoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.beneficiarios.adicionarCondicao(user, fichaId, dto);
  }

  @Patch("condicoes/:id")
  @ApiOperation({ summary: "Edita ou inativa uma condição crônica" })
  @ApiParam({ name: "id", description: "cuid da condição" })
  atualizarCondicao(
    @Param("id") id: string,
    @Body() dto: AtualizarCondicaoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.beneficiarios.atualizarCondicao(user, id, dto);
  }
}
