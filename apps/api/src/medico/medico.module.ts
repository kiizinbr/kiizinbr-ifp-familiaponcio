import { Module } from "@nestjs/common";

import { AgendaController } from "./agenda.controller";
import { AgendaService } from "./agenda.service";
import { AtendimentosController } from "./atendimentos.controller";
import { AtendimentosService } from "./atendimentos.service";
import { BeneficiariosController } from "./beneficiarios.controller";
import { BeneficiariosService } from "./beneficiarios.service";
import { DocumentoPdfService } from "./documento-pdf.service";
import { DocumentosController } from "./documentos.controller";
import { DocumentosService } from "./documentos.service";
import { EquipeController } from "./equipe.controller";
import { EquipeService } from "./equipe.service";
import { OdontogramaController } from "./odontograma.controller";
import { OdontogramaService } from "./odontograma.service";
import { ProfissionaisService } from "./profissionais.service";
import { TriagemEnfermagemController } from "./triagem-enfermagem.controller";
import { TriagemEnfermagemService } from "./triagem-enfermagem.service";
import { VerificacaoDocumentoController } from "./verificacao-documento.controller";

@Module({
  controllers: [
    AgendaController,
    AtendimentosController,
    BeneficiariosController,
    DocumentosController,
    EquipeController,
    OdontogramaController,
    TriagemEnfermagemController,
    VerificacaoDocumentoController,
  ],
  providers: [
    AgendaService,
    AtendimentosService,
    BeneficiariosService,
    DocumentoPdfService,
    DocumentosService,
    EquipeService,
    OdontogramaService,
    ProfissionaisService,
    TriagemEnfermagemService,
  ],
  exports: [AtendimentosService, ProfissionaisService],
})
export class MedicoModule {}
