import { Module } from "@nestjs/common";

import { MedicoModule } from "../medico/medico.module";
import { EsportivoController } from "./esportivo.controller";
import { GraduacaoPdfService } from "./graduacao-pdf.service";
import { GraduacoesService } from "./graduacoes.service";
import { TreinosService } from "./treinos.service";
import { TurmasEsportivasService } from "./turmas-esportivas.service";
import { VerificacaoGraduacaoController } from "./verificacao-graduacao.controller";

@Module({
  imports: [MedicoModule], // reusa ProfissionaisService (resolver + ownership)
  controllers: [EsportivoController, VerificacaoGraduacaoController],
  providers: [TurmasEsportivasService, GraduacoesService, GraduacaoPdfService, TreinosService],
})
export class EsportivoModule {}
