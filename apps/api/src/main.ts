import { NestFactory, Reflector } from "@nestjs/core";
import { ClassSerializerInterceptor, Logger, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";

import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log", "debug"],
  });

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

  const config = new DocumentBuilder()
    .setTitle("IFP Connect API")
    .setDescription("API do Instituto Família Poncio")
    .setVersion("0.0.1")
    .addBearerAuth()
    .build();
  SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, config));

  const configService = app.get(ConfigService);
  const port = configService.get<number>("PORT", 3333);
  await app.listen(port);

  Logger.log(`IFP Connect API rodando em http://localhost:${port}/api/v1`, "Bootstrap");
}

void bootstrap();
