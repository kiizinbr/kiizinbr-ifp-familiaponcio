import { Module } from "@nestjs/common";

import { BuscaController } from "./busca.controller";
import { BuscaService } from "./busca.service";

// PrismaService e AuditService vêm de módulos @Global.
@Module({
  controllers: [BuscaController],
  providers: [BuscaService],
})
export class BuscaModule {}
