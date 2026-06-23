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
import { TriagemEnfermagemController } from "./triagem-enfermagem.controller";
import { TriagemEnfermagemService } from "./triagem-enfermagem.service";

@Module({
  controllers: [
    AgendaController,
    AtendimentosController,
    BeneficiariosController,
    EquipeController,
    TriagemEnfermagemController,
  ],
  providers: [
    AgendaService,
    AtendimentosService,
    BeneficiariosService,
    EquipeService,
    ProfissionaisService,
    TriagemEnfermagemService,
  ],
  exports: [AtendimentosService, ProfissionaisService],
})
export class MedicoModule {}
