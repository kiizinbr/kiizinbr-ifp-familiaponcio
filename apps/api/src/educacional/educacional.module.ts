import { Module } from "@nestjs/common";

import { MedicoModule } from "../medico/medico.module";
import { ComunicadosController } from "./comunicados.controller";
import { ComunicadosService } from "./comunicados.service";
import { ConversasController } from "./conversas.controller";
import { ConversasService } from "./conversas.service";
import { CriancasController } from "./criancas.controller";
import { CriancasService } from "./criancas.service";
import { FamiliaController } from "./familia.controller";
import { FamiliaService } from "./familia.service";
import { IndicadoresController } from "./indicadores.controller";
import { IndicadoresService } from "./indicadores.service";
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
    IndicadoresController,
    ComunicadosController,
    ConversasController,
    FamiliaController,
  ],
  providers: [
    TurmasInfantisService,
    CriancasService,
    RotinaService,
    IndicadoresService,
    ComunicadosService,
    ConversasService,
    FamiliaService,
  ],
})
export class EducacionalModule {}
