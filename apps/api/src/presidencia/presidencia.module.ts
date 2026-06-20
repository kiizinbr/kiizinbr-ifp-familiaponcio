import { Module } from "@nestjs/common";

import { PresidenciaController } from "./presidencia.controller";
import { PresidenciaService } from "./presidencia.service";
import { PrestacaoContasPdfService } from "./prestacao-contas-pdf.service";

@Module({
  controllers: [PresidenciaController],
  providers: [PresidenciaService, PrestacaoContasPdfService],
})
export class PresidenciaModule {}
