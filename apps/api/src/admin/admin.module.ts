import { Module } from "@nestjs/common";

import { AuditoriaController } from "./auditoria.controller";
import { AuditoriaService } from "./auditoria.service";
import { UnidadesController } from "./unidades.controller";
import { UnidadesService } from "./unidades.service";
import { ComunicadosEntregaController } from "./comunicados-entrega.controller";
import { ComunicadosEntregaService } from "./comunicados-entrega.service";

// PrismaService e AuditService são providos por módulos @Global.
@Module({
  controllers: [AuditoriaController, UnidadesController, ComunicadosEntregaController],
  providers: [AuditoriaService, UnidadesService, ComunicadosEntregaService],
})
export class AdminModule {}
