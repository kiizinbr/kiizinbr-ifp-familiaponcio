import { Global, Module } from "@nestjs/common";

import { StorageController } from "./storage.controller";
import { StorageService } from "./storage.service";

/**
 * Fundação de storage (Onda C1).
 * @Global: o StorageService é injetável em qualquer módulo (C2 upload na ficha,
 * C3 fotos do diário) sem precisar re-importar o StorageModule em cada um —
 * mesmo padrão de PrismaModule/AuditModule.
 */
@Global()
@Module({
  controllers: [StorageController],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
