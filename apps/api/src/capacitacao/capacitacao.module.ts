import { Module } from "@nestjs/common";

import { MedicoModule } from "../medico/medico.module";
import { AulasController } from "./aulas.controller";
import { AulasService } from "./aulas.service";
import { TurmasController } from "./turmas.controller";
import { TurmasService } from "./turmas.service";
import { VerificacaoController } from "./verificacao.controller";

@Module({
  imports: [MedicoModule], // reusa ProfissionaisService (resolver + ownership)
  controllers: [TurmasController, AulasController, VerificacaoController],
  providers: [TurmasService, AulasService],
})
export class CapacitacaoModule {}
