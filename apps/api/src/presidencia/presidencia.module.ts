import { Module } from "@nestjs/common";

import { PresidenciaController } from "./presidencia.controller";
import { PresidenciaService } from "./presidencia.service";

@Module({
  controllers: [PresidenciaController],
  providers: [PresidenciaService],
})
export class PresidenciaModule {}
