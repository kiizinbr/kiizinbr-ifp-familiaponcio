import { Module } from "@nestjs/common";

import { CapacitacaoModule } from "../capacitacao/capacitacao.module";
import { MedicoModule } from "../medico/medico.module";
import { ComunicadosController } from "./comunicados.controller";
import { ComunicadosService } from "./comunicados.service";
import { ConversasController } from "./conversas.controller";
import { ConversasService } from "./conversas.service";
import { CriancasController } from "./criancas.controller";
import { CriancasService } from "./criancas.service";
import { FamiliaAgendaController } from "./familia-agenda.controller";
import { FamiliaAgendaService } from "./familia-agenda.service";
import { FamiliaController } from "./familia.controller";
import { FamiliaRecebidoController } from "./familia-recebido.controller";
import { FamiliaRecebidoService } from "./familia-recebido.service";
import { FamiliaService } from "./familia.service";
import { IndicadoresController } from "./indicadores.controller";
import { IndicadoresService } from "./indicadores.service";
import { RotinaController } from "./rotina.controller";
import { RotinaService } from "./rotina.service";
import { TurmasInfantisController } from "./turmas-infantis.controller";
import { TurmasInfantisService } from "./turmas-infantis.service";

@Module({
  imports: [
    MedicoModule, // reusa ProfissionaisService (resolver + parede de TipoUnidade)
    CapacitacaoModule, // reusa CertificadoPdfService (PDF do portal da família)
  ],
  controllers: [
    TurmasInfantisController,
    CriancasController,
    RotinaController,
    IndicadoresController,
    ComunicadosController,
    ConversasController,
    FamiliaController,
    FamiliaRecebidoController,
    FamiliaAgendaController,
  ],
  providers: [
    TurmasInfantisService,
    CriancasService,
    RotinaService,
    IndicadoresService,
    ComunicadosService,
    ConversasService,
    FamiliaService,
    FamiliaRecebidoService,
    FamiliaAgendaService,
  ],
})
export class EducacionalModule {}
