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
import { DocumentosService } from "./documentos.service";
import { CreateDocumentoDto } from "./dto/create-documento.dto";
import { RevogarDocumentoDto } from "./dto/revogar-documento.dto";

@ApiTags("medico")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PerfisGuard)
@Perfis(Perfil.SUPER_ADMIN, Perfil.PROFISSIONAL)
@Controller("medico")
export class DocumentosController {
  constructor(private readonly documentos: DocumentosService) {}

  @Post("atendimentos/:id/documentos")
  @ApiOperation({
    summary:
      "Emite um documento médico (atestado/receita/declaração) no atendimento. 409 se já selado.",
  })
  @ApiParam({ name: "id", description: "cuid do atendimento" })
  @HttpCode(HttpStatus.CREATED)
  emitir(
    @Param("id") id: string,
    @Body() dto: CreateDocumentoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentos.emitir(user, id, dto);
  }

  @Get("atendimentos/:id/documentos")
  @ApiOperation({ summary: "Lista os documentos emitidos no atendimento" })
  @ApiParam({ name: "id", description: "cuid do atendimento" })
  listar(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.documentos.listarDoAtendimento(user, id);
  }

  @Patch("documentos/:id/revogar")
  @ApiOperation({ summary: "Revoga um documento emitido (imutável; corrige-se revogando)" })
  @ApiParam({ name: "id", description: "cuid do documento" })
  @HttpCode(HttpStatus.OK)
  revogar(
    @Param("id") id: string,
    @Body() dto: RevogarDocumentoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentos.revogar(user, id, dto);
  }
}
