import { Controller, Get, Header, Query, StreamableFile, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Perfil } from "@ifp/database";

import { CurrentUser, type AuthenticatedUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Perfis } from "../auth/perfis.decorator";
import { PerfisGuard } from "../auth/perfis.guard";
import { AuditoriaService } from "./auditoria.service";
import { ListarAuditoriaDto } from "./dto/listar-auditoria.dto";

/**
 * Trilha de auditoria LGPD — somente SUPER_ADMIN. Só leitura/export; nenhuma
 * escrita (a gravação é do AuditService, espalhado pelos módulos sensíveis).
 */
@ApiTags("admin")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PerfisGuard)
@Perfis(Perfil.SUPER_ADMIN)
@Controller("admin/auditoria")
export class AuditoriaController {
  constructor(private readonly auditoria: AuditoriaService) {}

  @Get()
  @ApiOperation({ summary: "Lista a trilha de auditoria (filtros ator/ação/entidade/período)" })
  listar(@Query() dto: ListarAuditoriaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.auditoria.listar(user, dto);
  }

  @Get("facetas")
  @ApiOperation({ summary: "Valores distintos para os filtros (ações, entidades)" })
  facetas() {
    return this.auditoria.facetas();
  }

  @Get("export.csv")
  @ApiOperation({ summary: "Exporta a trilha filtrada em CSV (gera evento EXPORT)" })
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="auditoria-ifp.csv"')
  async exportar(
    @Query() dto: ListarAuditoriaDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StreamableFile> {
    const csv = await this.auditoria.exportarCsv(user, dto);
    // BOM para o Excel reconhecer UTF-8 (acentos PT-BR).
    return new StreamableFile(Buffer.from("﻿" + csv, "utf-8"));
  }
}
