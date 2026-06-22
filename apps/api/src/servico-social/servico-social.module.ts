import { Module } from "@nestjs/common";

import { EncaminhamentosController } from "./encaminhamentos.controller";
import { EncaminhamentosService } from "./encaminhamentos.service";
import { PonteController } from "./ponte.controller";
import { PonteService } from "./ponte.service";
import { TriagemController } from "./triagem.controller";
import { TriagemService } from "./triagem.service";

@Module({
  controllers: [TriagemController, EncaminhamentosController, PonteController],
  providers: [TriagemService, EncaminhamentosService, PonteService],
})
export class ServicoSocialModule {}
