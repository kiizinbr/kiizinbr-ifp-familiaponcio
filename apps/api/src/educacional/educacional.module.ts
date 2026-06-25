import { Module } from "@nestjs/common";

import { CapacitacaoModule } from "../capacitacao/capacitacao.module";
import { EsportivoModule } from "../esportivo/esportivo.module";
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
import { FamiliaFotosDiarioController } from "./familia-fotos-diario.controller";
import { FamiliaRecebidoController } from "./familia-recebido.controller";
import { FamiliaRecebidoService } from "./familia-recebido.service";
import { FamiliaTimelineController } from "./familia-timeline.controller";
import { FamiliaTimelineService } from "./familia-timeline.service";
import { FamiliaService } from "./familia.service";
import { FotosDiarioController } from "./fotos-diario.controller";
import { FotosDiarioService } from "./fotos-diario.service";
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
    EsportivoModule, // reusa GraduacaoPdfService (diploma do portal da família)
  ],
  controllers: [
    TurmasInfantisController,
    CriancasController,
    RotinaController,
    FotosDiarioController,
    IndicadoresController,
    ComunicadosController,
    ConversasController,
    FamiliaController,
    FamiliaFotosDiarioController,
    FamiliaRecebidoController,
    FamiliaAgendaController,
    FamiliaTimelineController,
  ],
  providers: [
    TurmasInfantisService,
    CriancasService,
    RotinaService,
    FotosDiarioService,
    IndicadoresService,
    ComunicadosService,
    ConversasService,
    FamiliaService,
    FamiliaRecebidoService,
    FamiliaAgendaService,
    FamiliaTimelineService,
  ],
})
export class EducacionalModule {}
