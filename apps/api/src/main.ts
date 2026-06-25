import { NestFactory, Reflector } from "@nestjs/core";
import { ClassSerializerInterceptor, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Logger as PinoAppLogger } from "nestjs-pino";
import helmet from "helmet";

import { AppModule } from "./app.module";

async function bootstrap() {
  // bufferLogs: segura os logs do boot até o logger do pino estar pronto, então
  // TODO log (inclusive o de inicialização) sai em JSON estruturado e redatado.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Substitui o logger nativo do Nest pelo pino (estruturado + redação — P1.8).
  app.useLogger(app.get(PinoAppLogger));

  app.use(helmet());
  app.enableCors({
    origin: process.env.WEB_ORIGIN?.split(",") ?? ["http://localhost:3000"],
    credentials: true,
  });

  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // Swagger só fora de produção — em prod /api/docs expõe o mapa inteiro da API
  // (rotas, DTOs, contratos) sem nenhuma autenticação.
  if (process.env.NODE_ENV !== "production") {
    const config = new DocumentBuilder()
      .setTitle("IFP Connect API")
      .setDescription("API do Instituto Família Poncio")
      .setVersion("0.0.1")
      .addBearerAuth()
      .build();
    SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, config));
  }

  const configService = app.get(ConfigService);
  const port = configService.get<number>("PORT", 3333);
  await app.listen(port);

  app
    .get(PinoAppLogger)
    .log(`IFP Connect API rodando em http://localhost:${port}/api/v1`, "Bootstrap");
}

void bootstrap();
