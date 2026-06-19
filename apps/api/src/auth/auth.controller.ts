import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";

import { AuthService } from "./auth.service";
import { CurrentUser, type AuthenticatedUser } from "./current-user.decorator";
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
  @ApiOperation({ summary: "Login por e-mail e senha (retorna JWT)" })
  @ApiBody({ type: LoginDto })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.senha);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @PermiteSenhaProvisoria()
  @ApiBearerAuth()
  @ApiOperation({ summary: "Retorna o usuário autenticado" })
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
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
