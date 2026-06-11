import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { EscopoImagem, Perfil } from "@ifp/database";

import { CurrentUser, type AuthenticatedUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Perfis } from "../auth/perfis.decorator";
import { PerfisGuard } from "../auth/perfis.guard";
import { CriancasService } from "./criancas.service";
import { AtualizarAutorizacaoImagemDto } from "./dto/atualizar-autorizacao-imagem.dto";
import { CriarAutorizadoDto } from "./dto/criar-autorizado.dto";

@ApiTags("educacional")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PerfisGuard)
@Perfis(Perfil.SUPER_ADMIN, Perfil.GESTOR_UNIDADE, Perfil.PROFISSIONAL)
@Controller("educacional/criancas")
export class CriancasController {
  constructor(private readonly criancas: CriancasService) {}

  @Get(":membroId")
  @ApiOperation({ summary: "Perfil da criança: alergias, autorizados, imagem, histórico" })
  @ApiParam({ name: "membroId", description: "cuid do MembroFamiliar (criança)" })
  perfil(@Param("membroId") membroId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.criancas.perfil(user, membroId);
  }

  @Get(":membroId/autorizados")
  @ApiOperation({ summary: "Lista de autorizados (restrição judicial em destaque)" })
  @ApiParam({ name: "membroId", description: "cuid do MembroFamiliar (criança)" })
  autorizados(@Param("membroId") membroId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.criancas.listarAutorizados(user, membroId);
  }

  @Post(":membroId/autorizados")
  @Perfis(Perfil.SUPER_ADMIN, Perfil.GESTOR_UNIDADE)
  @ApiOperation({ summary: "Cadastra pessoa autorizada a entregar/retirar (audit obrigatório)" })
  @ApiParam({ name: "membroId", description: "cuid do MembroFamiliar (criança)" })
  criarAutorizado(
    @Param("membroId") membroId: string,
    @Body() dto: CriarAutorizadoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.criancas.criarAutorizado(user, membroId, dto);
  }

  @Patch("autorizados/:id/revogar")
  @Perfis(Perfil.SUPER_ADMIN, Perfil.GESTOR_UNIDADE)
  @ApiOperation({ summary: "Revoga autorização — efeito imediato, registro preservado" })
  @ApiParam({ name: "id", description: "cuid do ResponsavelAutorizado" })
  @HttpCode(HttpStatus.OK)
  revogar(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.criancas.revogarAutorizado(user, id);
  }

  @Patch(":membroId/autorizacoes-imagem/:escopo")
  @Perfis(Perfil.SUPER_ADMIN, Perfil.GESTOR_UNIDADE)
  @ApiOperation({ summary: "Concede/revoga autorização de imagem por escopo (default negado)" })
  @ApiParam({ name: "membroId", description: "cuid do MembroFamiliar (criança)" })
  @ApiParam({ name: "escopo", enum: EscopoImagem })
  @HttpCode(HttpStatus.OK)
  autorizacaoImagem(
    @Param("membroId") membroId: string,
    @Param("escopo", new ParseEnumPipe(EscopoImagem)) escopo: EscopoImagem,
    @Body() dto: AtualizarAutorizacaoImagemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.criancas.atualizarAutorizacaoImagem(user, membroId, escopo, dto);
  }
}
