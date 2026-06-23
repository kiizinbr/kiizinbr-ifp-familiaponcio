import { Module } from "@nestjs/common";

import { MedicoModule } from "../medico/medico.module";
import { AulasController } from "./aulas.controller";
import { AulasService } from "./aulas.service";
import { BancoModelosController } from "./banco-modelos.controller";
import { BancoModelosService } from "./banco-modelos.service";
import { CertificadoPdfService } from "./certificado-pdf.service";
import { CursosController } from "./cursos.controller";
import { CursosService } from "./cursos.service";
import { TurmasController } from "./turmas.controller";
import { TurmasService } from "./turmas.service";
import { VerificacaoController } from "./verificacao.controller";

@Module({
  imports: [MedicoModule], // reusa ProfissionaisService (resolver + ownership)
  controllers: [
    TurmasController,
    AulasController,
    CursosController,
    VerificacaoController,
    BancoModelosController,
  ],
  providers: [
    TurmasService,
    AulasService,
    CursosService,
    CertificadoPdfService,
    BancoModelosService,
  ],
  exports: [CertificadoPdfService], // reusado pelo portal da família (educacional)
})
export class CapacitacaoModule {}
