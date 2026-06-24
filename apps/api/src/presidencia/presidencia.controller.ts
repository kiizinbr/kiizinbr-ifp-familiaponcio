import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { Perfil } from "@ifp/database";

import { CurrentUser, type AuthenticatedUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Perfis } from "../auth/perfis.decorator";
import { PerfisGuard } from "../auth/perfis.guard";
import { PresidenciaService } from "./presidencia.service";
import { PrestacaoContasPdfService } from "./prestacao-contas-pdf.service";
import { RelatoriosService } from "./relatorios.service";
import { GerarRelatorioDto } from "./dto/gerar-relatorio.dto";

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
    private readonly relatorios: RelatoriosService,
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

  @Get("impacto-series")
  @ApiOperation({
    summary: "Séries temporais por mês cruzando as verticais (últimos N meses)",
  })
  @ApiQuery({ name: "meses", required: false, description: "3 a 24 (default 12)" })
  impactoSeries(@Query("meses") meses: string, @CurrentUser() user: AuthenticatedUser) {
    return this.presidencia.impactoSeries(user, meses);
  }

  @Get("jornada")
  @ApiOperation({ summary: "Jornada da Família: famílias que cruzam 2+ unidades" })
  jornada(@CurrentUser() user: AuthenticatedUser) {
    return this.presidencia.jornada(user);
  }

  @Get("territorio")
  @ApiOperation({
    summary: "Panorama territorial: distribuição de famílias por bairro (não é mapa)",
  })
  territorio(@CurrentUser() user: AuthenticatedUser) {
    return this.presidencia.territorio(user);
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
    @Req() req: Request,
  ): Promise<StreamableFile> {
    const { buffer, filename } = await this.prestacaoPdf.gerar(user, periodo, {
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });
    return new StreamableFile(buffer, {
      type: "application/pdf",
      disposition: `inline; filename="${filename}"`,
    });
  }

  // ============================================================
  // Relatórios institucionais selados (model RelatorioPDF)
  // ============================================================
  @Get("relatorios")
  @ApiOperation({ summary: "Lista os relatórios institucionais já gerados (manifesto)" })
  listarRelatorios(@CurrentUser() user: AuthenticatedUser) {
    return this.relatorios.listar(user);
  }

  @Post("relatorios")
  @ApiOperation({ summary: "Gera um relatório institucional selado (registra metadados)" })
  gerarRelatorio(
    @Body() dto: GerarRelatorioDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.relatorios.gerar(user, dto, {
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });
  }

  @Get("relatorios/:id/pdf")
  @ApiOperation({ summary: "Baixa o PDF selado de um relatório (regerado dos números reais)" })
  async baixarRelatorio(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<StreamableFile> {
    const { buffer, filename } = await this.relatorios.baixar(user, id, {
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });
    return new StreamableFile(buffer, {
      type: "application/pdf",
      disposition: `inline; filename="${filename}"`,
    });
  }
}
