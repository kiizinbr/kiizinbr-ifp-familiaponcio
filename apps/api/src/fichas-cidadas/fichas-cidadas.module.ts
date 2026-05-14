import { Module } from "@nestjs/common";

import { FichasCidadasController } from "./fichas-cidadas.controller";
import { FichasCidadasService } from "./fichas-cidadas.service";

@Module({
  controllers: [FichasCidadasController],
  providers: [FichasCidadasService],
  exports: [FichasCidadasService],
})
export class FichasCidadasModule {}
