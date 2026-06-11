import { Module } from "@nestjs/common";

import { MedicoModule } from "../medico/medico.module";
import { ComunicadosController } from "./comunicados.controller";
import { ComunicadosService } from "./comunicados.service";
import { CriancasController } from "./criancas.controller";
import { CriancasService } from "./criancas.service";
import { FamiliaController } from "./familia.controller";
import { FamiliaService } from "./familia.service";
import { RotinaController } from "./rotina.controller";
import { RotinaService } from "./rotina.service";
import { TurmasInfantisController } from "./turmas-infantis.controller";
import { TurmasInfantisService } from "./turmas-infantis.service";

@Module({
  imports: [MedicoModule], // reusa ProfissionaisService (resolver + parede de TipoUnidade)
  controllers: [
    TurmasInfantisController,
    CriancasController,
    RotinaController,
    ComunicadosController,
    FamiliaController,
  ],
  providers: [
    TurmasInfantisService,
    CriancasService,
    RotinaService,
    ComunicadosService,
    FamiliaService,
  ],
})
export class EducacionalModule {}
