import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { Perfil } from "@ifp/database";

import { CurrentUser, type AuthenticatedUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Perfis } from "../auth/perfis.decorator";
import { PerfisGuard } from "../auth/perfis.guard";
import { AnexarFotoDiarioDto } from "./dto/anexar-foto-diario.dto";
import { FotosDiarioService } from "./fotos-diario.service";

/**
 * Fotos do diário da creche — lado EQUIPE (Onda C3).
 *
 * Mesmo portão do diário/rotina (SUPER_ADMIN + GESTOR_UNIDADE + PROFISSIONAL);
 * o service resolve o Profissional e barra criança fora da unidade (parede de
 * tenant). Família e demais perfis caem no PerfisGuard com 403.
 */
@ApiTags("educacional")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PerfisGuard)
@Perfis(Perfil.SUPER_ADMIN, Perfil.GESTOR_UNIDADE, Perfil.PROFISSIONAL)
@Controller("educacional/diarios")
export class FotosDiarioController {
  constructor(private readonly fotos: FotosDiarioService) {}

  @Post(":membroId/fotos")
  @ApiOperation({ summary: "Anexa foto ao diário do dia (JPG/PNG/WEBP, até 8 MB); FECHADO → 409" })
  @ApiParam({ name: "membroId", description: "cuid do MembroFamiliar (criança)" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["arquivo"],
      properties: {
        arquivo: { type: "string", format: "binary" },
        legenda: { type: "string" },
      },
    },
  })
  @UseInterceptors(FileInterceptor("arquivo"))
  @HttpCode(HttpStatus.CREATED)
  anexar(
    @Param("membroId") membroId: string,
    @Body() dto: AnexarFotoDiarioDto,
    @UploadedFile() arquivo: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.fotos.anexar(user, membroId, arquivo, dto.legenda);
  }

  @Get(":membroId/fotos")
  @ApiOperation({ summary: "Fotos do diário do dia da criança (visão da educadora)" })
  @ApiParam({ name: "membroId", description: "cuid do MembroFamiliar (criança)" })
  listar(
    @Param("membroId") membroId: string,
    @Query("data") data: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.fotos.listarEducadora(user, membroId, data);
  }

  @Get("fotos/:fotoId/download")
  @ApiOperation({ summary: "URL pré-assinada da foto (checa unidade/ownership)" })
  @ApiParam({ name: "fotoId", description: "cuid da FotoDiario" })
  download(@Param("fotoId") fotoId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.fotos.downloadEducadora(user, fotoId);
  }

  @Delete("fotos/:fotoId")
  @ApiOperation({ summary: "Remove a foto do storage e do diário; FECHADO → 409" })
  @ApiParam({ name: "fotoId", description: "cuid da FotoDiario" })
  @HttpCode(HttpStatus.OK)
  remover(@Param("fotoId") fotoId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.fotos.remover(user, fotoId);
  }
}
