import { Module } from "@nestjs/common";

import { AgendaController } from "./agenda.controller";
import { AgendaService } from "./agenda.service";
import { AtendimentosController } from "./atendimentos.controller";
import { AtendimentosService } from "./atendimentos.service";
import { BeneficiariosController } from "./beneficiarios.controller";
import { BeneficiariosService } from "./beneficiarios.service";
import { EquipeController } from "./equipe.controller";
import { EquipeService } from "./equipe.service";
import { ProfissionaisService } from "./profissionais.service";

@Module({
  controllers: [
    AgendaController,
    AtendimentosController,
    BeneficiariosController,
    EquipeController,
  ],
  providers: [
    AgendaService,
    AtendimentosService,
    BeneficiariosService,
    EquipeService,
    ProfissionaisService,
  ],
  exports: [AtendimentosService, ProfissionaisService],
})
export class MedicoModule {}
