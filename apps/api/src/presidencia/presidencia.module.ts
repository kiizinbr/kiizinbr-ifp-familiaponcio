import { Module } from "@nestjs/common";

import { PresidenciaController } from "./presidencia.controller";
import { PresidenciaService } from "./presidencia.service";
import { PrestacaoContasPdfService } from "./prestacao-contas-pdf.service";
import { RelatoriosService } from "./relatorios.service";

@Module({
  controllers: [PresidenciaController],
  providers: [PresidenciaService, PrestacaoContasPdfService, RelatoriosService],
})
export class PresidenciaModule {}
