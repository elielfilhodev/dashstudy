import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { ConfigModule } from './common/config/config.module';
import { ENV, type Env } from './common/config/env';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { EnvelopeInterceptor } from './common/interceptors/envelope.interceptor';
import { MailModule } from './common/mail/mail.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { BooksModule } from './modules/books/books.module';
import { ChatModule } from './modules/chat/chat.module';
import { FriendsModule } from './modules/friends/friends.module';
import { HealthController } from './modules/health/health.controller';
import { MiscModule } from './modules/misc/misc.module';
import { StudyModule } from './modules/study/study.module';
import { UsersModule } from './modules/users/users.module';

const AUTH_PREFIX = '/api/v1/auth';

function isAuthRoute(ctx: ExecutionContext): boolean {
  return ctx.switchToHttp().getRequest<Request>().path.startsWith(AUTH_PREFIX);
}

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    MailModule,
    ThrottlerModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({
        throttlers: [
          {
            name: 'default',
            ttl: 60_000,
            limit: env.RATE_LIMIT_PER_MINUTE,
            skipIf: isAuthRoute,
          },
          {
            name: 'auth',
            ttl: 60_000,
            limit: env.AUTH_RATE_LIMIT_PER_MINUTE,
            skipIf: (ctx: ExecutionContext) => !isAuthRoute(ctx),
          },
        ],
      }),
    }),
    AuthModule,
    UsersModule,
    StudyModule,
    FriendsModule,
    BooksModule,
    ChatModule,
    MiscModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
  ],
})
export class AppModule {}
