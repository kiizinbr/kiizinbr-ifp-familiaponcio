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
import { ServicoSocialModule } from "./servico-social/servico-social.module";
import { MedicoModule } from "./medico/medico.module";
import { CapacitacaoModule } from "./capacitacao/capacitacao.module";
import { EducacionalModule } from "./educacional/educacional.module";
import { EsportivoModule } from "./esportivo/esportivo.module";
import { PresidenciaModule } from "./presidencia/presidencia.module";
import { BuscaModule } from "./busca/busca.module";

@Module({
  imports: [
    // .env vive na raiz do monorepo; em dev (turbo) o cwd é apps/api.
    ConfigModule.forRoot({ isGlobal: true, cache: true, envFilePath: ["../../.env", ".env"] }),
    // Teto global de requisições; o login tem limite próprio (10/min) em auth.controller.
    // skipIf desliga o throttle só em regressão/E2E em lote (que bate no rate-limit do
    // login). Guarda dupla: exige THROTTLE_DISABLED=1 E NODE_ENV != production — assim,
    // mesmo que a env vaze para produção, o throttle continua ativo lá.
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 120 }],
      skipIf: () =>
        process.env.THROTTLE_DISABLED === "1" && process.env.NODE_ENV !== "production",
    }),
    PrismaModule,
    AuditModule,
    AuthModule,
    UsersModule,
    TenantsModule,
    FichasCidadasModule,
    ServicoSocialModule,
    MedicoModule,
    CapacitacaoModule,
    EducacionalModule,
    EsportivoModule,
    PresidenciaModule,
    BuscaModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
