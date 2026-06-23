import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import { AuthService } from "./auth.service";
import { CurrentUser, type AuthenticatedUser } from "./current-user.decorator";
import { EscolherUnidadeDto } from "./dto/escolher-unidade.dto";
import { LoginDto } from "./dto/login.dto";
import { TrocarSenhaDto } from "./dto/trocar-senha.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { PermiteSenhaProvisoria } from "./permite-senha-provisoria.decorator";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  // Anti-brute-force: bem mais apertado que o teto global (120/min). 10 tentativas
  // por minuto por IP barram credential-stuffing sem atrapalhar uso/regressão legítimos.
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: "Login por e-mail e senha (retorna JWT)" })
  @ApiBody({ type: LoginDto })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.senha);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @PermiteSenhaProvisoria()
  @ApiBearerAuth()
  @ApiOperation({ summary: "Retorna os dados completos do usuário autenticado (Minha conta)" })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.me(user.id);
  }

  @Post("unidade-ativa")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Seletor de unidade pós-login: ativa uma das PRÓPRIAS unidades (404 se não for sua)",
  })
  @ApiBody({ type: EscolherUnidadeDto })
  escolherUnidade(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: EscolherUnidadeDto,
  ) {
    return this.auth.escolherUnidade(user.id, dto.unidadeId);
  }

  @Post("trocar-senha")
  @UseGuards(JwtAuthGuard)
  @PermiteSenhaProvisoria()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Troca a própria senha (usado no primeiro acesso)" })
  @ApiBody({ type: TrocarSenhaDto })
  trocarSenha(@CurrentUser() user: AuthenticatedUser, @Body() dto: TrocarSenhaDto) {
    return this.auth.trocarSenha(user.id, dto.senhaAtual, dto.novaSenha);
  }
}
