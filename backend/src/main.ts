import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { ENV, type Env } from './common/config/env';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  const env = app.get<Env>(ENV);

  app.set('trust proxy', 1);
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
      hsts: env.isProduction ? undefined : false,
    }),
  );
  app.use(json({ limit: env.MAX_BODY_BYTES }));
  app.use(urlencoded({ extended: true, limit: env.MAX_BODY_BYTES }));

  if (env.allowedOrigins.length > 0) {
    app.enableCors({
      origin: env.allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-ID'],
    });
  }

  app.enableShutdownHooks();

  await app.listen(env.PORT, '0.0.0.0');
  new Logger('Bootstrap').log(
    `API em http://localhost:${env.PORT}/api/v1 (${env.NODE_ENV})`,
  );
}

void bootstrap();
