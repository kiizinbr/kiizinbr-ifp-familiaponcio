import {
  Body,
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
import { ConsentirDadosFamiliaDto } from "./dto/consentir-dados-familia.dto";
import { ConsentirImagemFamiliaDto } from "./dto/consentir-imagem-familia.dto";
import { CriarConversaDto } from "./dto/criar-conversa.dto";
import { CriarMensagemDto } from "./dto/criar-mensagem.dto";
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

  @Post("ficha/:membroId/consentimento-imagem")
  @ApiOperation({
    summary: "Titular dá/revoga consentimento de uso de imagem da criança (LGPD)",
  })
  @ApiParam({ name: "membroId", description: "cuid da criança (da própria família)" })
  @HttpCode(HttpStatus.OK)
  consentirImagem(
    @Param("membroId") membroId: string,
    @Body() dto: ConsentirImagemFamiliaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.familia.consentirImagem(user, membroId, dto);
  }

  @Post("consentimento-dados")
  @ApiOperation({
    summary: "Titular dá/revoga consentimento de uso/compartilhamento de dados (LGPD)",
  })
  @HttpCode(HttpStatus.OK)
  consentirDados(
    @Body() dto: ConsentirDadosFamiliaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.familia.consentirDados(user, dto);
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

  @Post("conversas")
  @ApiOperation({ summary: "Abre (get-or-create) a conversa 1:1 da criança com o instituto" })
  abrirConversa(@Body() dto: CriarConversaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.familia.abrirConversa(user, dto);
  }

  @Get("conversas")
  @ApiOperation({ summary: "Minhas conversas (última mensagem + não lidas da equipe)" })
  conversas(@CurrentUser() user: AuthenticatedUser) {
    return this.familia.listarConversas(user);
  }

  @Get("conversas/:id")
  @ApiOperation({ summary: "Thread da conversa (marca mensagens da equipe como lidas)" })
  @ApiParam({ name: "id", description: "cuid da conversa" })
  conversa(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.familia.threadConversa(user, id);
  }

  @Post("conversas/:id/mensagens")
  @ApiOperation({ summary: "Envia mensagem como responsável (ladoEquipe=false)" })
  @ApiParam({ name: "id", description: "cuid da conversa" })
  enviarMensagem(
    @Param("id") id: string,
    @Body() dto: CriarMensagemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.familia.enviarMensagem(user, id, dto);
  }
}
