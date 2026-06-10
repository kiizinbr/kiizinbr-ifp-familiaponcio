import { Module } from "@nestjs/common";

import { AgendaController } from "./agenda.controller";
import { AgendaService } from "./agenda.service";
import { AtendimentosController } from "./atendimentos.controller";
import { AtendimentosService } from "./atendimentos.service";
import { ProfissionaisService } from "./profissionais.service";

@Module({
  controllers: [AgendaController, AtendimentosController],
  providers: [AgendaService, AtendimentosService, ProfissionaisService],
  exports: [AtendimentosService, ProfissionaisService],
})
export class MedicoModule {}
