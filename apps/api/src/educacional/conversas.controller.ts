import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { Perfil } from "@ifp/database";

import { CurrentUser, type AuthenticatedUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Perfis } from "../auth/perfis.decorator";
import { PerfisGuard } from "../auth/perfis.guard";
import { ConversasService } from "./conversas.service";
import { CriarConversaDto } from "./dto/criar-conversa.dto";
import { CriarMensagemDto } from "./dto/criar-mensagem.dto";

/**
 * Lado EQUIPE da mensagem 1:1 família↔instituto. Educadora participa
 * (PROFISSIONAL incluso — chat é operação do dia a dia, não publicação);
 * a parede de tenant é o resolverPorUser(EDUCACIONAL) no service.
 */
@ApiTags("educacional")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PerfisGuard)
@Perfis(Perfil.SUPER_ADMIN, Perfil.GESTOR_UNIDADE, Perfil.PROFISSIONAL)
@Controller("educacional/conversas")
export class ConversasController {
  constructor(private readonly conversas: ConversasService) {}

  @Post()
  @ApiOperation({ summary: "Abre (get-or-create idempotente) a conversa da criança" })
  abrir(@Body() dto: CriarConversaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.conversas.abrirConversaEquipe(user, dto);
  }

  @Get()
  @ApiOperation({ summary: "Conversas da unidade com última mensagem e não lidas" })
  listar(@CurrentUser() user: AuthenticatedUser) {
    return this.conversas.listarConversasEquipe(user);
  }

  @Get(":id")
  @ApiOperation({ summary: "Thread da conversa (marca mensagens da família como lidas)" })
  @ApiParam({ name: "id", description: "cuid da conversa" })
  thread(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.conversas.abrirThreadEquipe(user, id);
  }

  @Post(":id/mensagens")
  @ApiOperation({ summary: "Envia mensagem como instituto (ladoEquipe=true)" })
  @ApiParam({ name: "id", description: "cuid da conversa" })
  enviar(
    @Param("id") id: string,
    @Body() dto: CriarMensagemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.conversas.enviarMensagemEquipe(user, id, dto);
  }
}
