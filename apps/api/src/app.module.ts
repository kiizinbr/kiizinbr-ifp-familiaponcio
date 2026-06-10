import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";

import { HealthController } from "./health.controller";
import { PrismaModule } from "./prisma/prisma.module";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { TenantsModule } from "./tenants/tenants.module";
import { FichasCidadasModule } from "./fichas-cidadas/fichas-cidadas.module";
import { MedicoModule } from "./medico/medico.module";

@Module({
  imports: [
    // .env vive na raiz do monorepo; em dev (turbo) o cwd é apps/api.
    ConfigModule.forRoot({ isGlobal: true, cache: true, envFilePath: ["../../.env", ".env"] }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuditModule,
    AuthModule,
    UsersModule,
    TenantsModule,
    FichasCidadasModule,
    MedicoModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
