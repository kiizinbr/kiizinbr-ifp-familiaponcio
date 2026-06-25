import {
  Controller,
  Get,
  Param,
  Req,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { Perfil } from "@ifp/database";

import { CurrentUser, type AuthenticatedUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Perfis } from "../auth/perfis.decorator";
import { PerfisGuard } from "../auth/perfis.guard";
import { FamiliaRecebidoService } from "./familia-recebido.service";

/**
 * Portal da família — "O que recebi" + galeria de certificados/graduações.
 * EXCLUSIVO do responsável (ownership por User.fichaCidadaId). Nunca aceita
 * fichaId do client; o PDF confere o dono antes de gerar (IDOR).
 */
@ApiTags("familia")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PerfisGuard)
@Perfis(Perfil.RESPONSAVEL_FAMILIAR)
@Controller("familia")
export class FamiliaRecebidoController {
  constructor(private readonly recebido: FamiliaRecebidoService) {}

  @Get("recebido")
  @ApiOperation({ summary: "Resumo do que a família recebeu nas verticais (read agregado)" })
  recebidoFamilia(@CurrentUser() user: AuthenticatedUser) {
    return this.recebido.recebido(user);
  }

  @Get("certificados")
  @ApiOperation({ summary: "Galeria de certificados (capacitação) e graduações (esporte) da família" })
  certificados(@CurrentUser() user: AuthenticatedUser) {
    return this.recebido.certificados(user);
  }

  @Get("certificados/:codigo/pdf")
  @ApiOperation({ summary: "Baixa o PDF do certificado da PRÓPRIA família (IDOR: outra família → 404)" })
  @ApiParam({ name: "codigo", description: "código de verificação do certificado" })
  async certificadoPdf(
    @Param("codigo") codigo: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<StreamableFile> {
    const { buffer, filename } = await this.recebido.certificadoPdf(user, codigo, {
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });
    return new StreamableFile(buffer, {
      type: "application/pdf",
      disposition: `inline; filename="${filename}"`,
    });
  }

  @Get("graduacoes/:codigo/pdf")
  @ApiOperation({ summary: "Baixa o diploma de graduação da PRÓPRIA família (IDOR: outra família → 404)" })
  @ApiParam({ name: "codigo", description: "código de verificação da graduação" })
  async graduacaoPdf(
    @Param("codigo") codigo: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<StreamableFile> {
    const { buffer, filename } = await this.recebido.graduacaoPdf(user, codigo, {
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });
    return new StreamableFile(buffer, {
      type: "application/pdf",
      disposition: `inline; filename="${filename}"`,
    });
  }
}
