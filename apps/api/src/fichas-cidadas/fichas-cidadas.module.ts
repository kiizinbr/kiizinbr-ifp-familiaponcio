import { Module } from "@nestjs/common";

import { DocumentosController } from "./documentos.controller";
import { DocumentosService } from "./documentos.service";
import { FichasCidadasController } from "./fichas-cidadas.controller";
import { FichasCidadasService } from "./fichas-cidadas.service";

@Module({
  controllers: [FichasCidadasController, DocumentosController],
  providers: [FichasCidadasService, DocumentosService],
  exports: [FichasCidadasService],
})
export class FichasCidadasModule {}
