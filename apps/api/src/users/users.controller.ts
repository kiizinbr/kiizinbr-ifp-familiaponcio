import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
import { CriarUsuarioDto } from "./dto/criar-usuario.dto";
import { DefinirAtivoDto } from "./dto/definir-ativo.dto";
import { UsersService } from "./users.service";

@ApiTags("users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PerfisGuard)
@Perfis(Perfil.SUPER_ADMIN, Perfil.GESTOR_UNIDADE)
@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post()
  @ApiOperation({ summary: "Cria usuário com senha provisória (mostrada na resposta)" })
  criar(@Body() dto: CriarUsuarioDto, @CurrentUser() user: AuthenticatedUser) {
    return this.users.criar(user, dto);
  }

  @Get()
  @ApiOperation({ summary: "Lista usuários (gestor vê só os das próprias unidades)" })
  listar(@CurrentUser() user: AuthenticatedUser) {
    return this.users.listar(user);
  }

  @Post(":id/reset-senha")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Gera nova senha provisória e força a troca no próximo login" })
  @ApiParam({ name: "id", description: "cuid do usuário" })
  resetarSenha(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.users.resetarSenha(user, id);
  }

  @Patch(":id/ativo")
  @ApiOperation({ summary: "Ativa ou desativa o acesso de um usuário" })
  @ApiParam({ name: "id", description: "cuid do usuário" })
  definirAtivo(
    @Param("id") id: string,
    @Body() dto: DefinirAtivoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.users.definirAtivo(user, id, dto.ativo);
  }
}
