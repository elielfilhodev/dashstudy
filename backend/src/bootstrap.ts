import type { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import type { Env } from './common/config/env';

/**
 * Configuração aplicada à aplicação, compartilhada entre o servidor e os
 * testes e2e — assim a suíte exercita exatamente o mesmo pipeline HTTP que
 * roda em produção (prefixo, headers de segurança, limites de corpo, CORS).
 *
 * Não há ValidationPipe global: a validação é feita por rota com
 * `ZodValidationPipe`.
 */
export function configureApp(app: NestExpressApplication, env: Env): void {
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
}
