import { Controller, Get, Query, StreamableFile, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { Perfil } from "@ifp/database";

import { CurrentUser, type AuthenticatedUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Perfis } from "../auth/perfis.decorator";
import { PerfisGuard } from "../auth/perfis.guard";
import { PresidenciaService } from "./presidencia.service";
import { PrestacaoContasPdfService } from "./prestacao-contas-pdf.service";

/**
 * Sala de Comando — exclusiva da Presidência (e do Super Admin). Só leitura:
 * agregações cross-unidade, anônimas, sobre dados que o banco já tem.
 */
@ApiTags("presidencia")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PerfisGuard)
@Perfis(Perfil.SUPER_ADMIN, Perfil.PRESIDENCIA)
@Controller("presidencia")
export class PresidenciaController {
  constructor(
    private readonly presidencia: PresidenciaService,
    private readonly prestacaoPdf: PrestacaoContasPdfService,
  ) {}

  @Get("resumo")
  @ApiOperation({ summary: "Painel: KPIs de volume cruzando todas as unidades" })
  resumo(@CurrentUser() user: AuthenticatedUser) {
    return this.presidencia.resumo(user);
  }

  @Get("familias")
  @ApiOperation({ summary: "Retrato agregado e anônimo da base de famílias" })
  familias(@CurrentUser() user: AuthenticatedUser) {
    return this.presidencia.familias(user);
  }

  @Get("unidades")
  @ApiOperation({ summary: "Ocupação, fila e volume de cada salão" })
  unidades(@CurrentUser() user: AuthenticatedUser) {
    return this.presidencia.unidades(user);
  }

  @Get("impacto")
  @ApiOperation({ summary: "Tendência de famílias e atendimentos (12 meses)" })
  impacto(@CurrentUser() user: AuthenticatedUser) {
    return this.presidencia.impacto(user);
  }

  @Get("jornada")
  @ApiOperation({ summary: "Jornada da Família: famílias que cruzam 2+ unidades" })
  jornada(@CurrentUser() user: AuthenticatedUser) {
    return this.presidencia.jornada(user);
  }

  @Get("prestacao-contas")
  @ApiOperation({ summary: "Números reais de um período (mes|ano|12m)" })
  @ApiQuery({ name: "periodo", required: false, enum: ["mes", "ano", "12m"] })
  prestacaoContas(@Query("periodo") periodo: string, @CurrentUser() user: AuthenticatedUser) {
    return this.presidencia.prestacaoContas(user, periodo);
  }

  @Get("prestacao-contas/pdf")
  @ApiOperation({ summary: "Baixa a prestação de contas do período em PDF (selo CASA)" })
  @ApiQuery({ name: "periodo", required: false, enum: ["mes", "ano", "12m"] })
  async prestacaoContasPdf(
    @Query("periodo") periodo: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StreamableFile> {
    const { buffer, filename } = await this.prestacaoPdf.gerar(user, periodo);
    return new StreamableFile(buffer, {
      type: "application/pdf",
      disposition: `inline; filename="${filename}"`,
    });
  }
}
