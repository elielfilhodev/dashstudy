import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { ENV, type Env } from './common/config/env';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  const env = app.get<Env>(ENV);

  configureApp(app, env);
  app.enableShutdownHooks();

  await app.listen(env.PORT, '0.0.0.0');
  new Logger('Bootstrap').log(
    `API em http://localhost:${env.PORT}/api/v1 (${env.NODE_ENV})`,
  );
}

void bootstrap();
