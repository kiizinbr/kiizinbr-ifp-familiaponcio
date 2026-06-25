import { Module } from "@nestjs/common";

import { AuditoriaController } from "./auditoria.controller";
import { AuditoriaService } from "./auditoria.service";
import { UnidadesController } from "./unidades.controller";
import { UnidadesService } from "./unidades.service";
import { ComunicadosEntregaController } from "./comunicados-entrega.controller";
import { ComunicadosEntregaService } from "./comunicados-entrega.service";
import { ConfigController } from "./config.controller";
import { ConfigService } from "./config.service";

// PrismaService e AuditService são providos por módulos @Global.
@Module({
  controllers: [
    AuditoriaController,
    UnidadesController,
    ComunicadosEntregaController,
    ConfigController,
  ],
  providers: [AuditoriaService, UnidadesService, ComunicadosEntregaService, ConfigService],
})
export class AdminModule {}
