import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ENV, type Env } from '../../common/config/env';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GithubAuthGuard } from './github-auth.guard';
import { GithubStrategy } from './github.strategy';
import { JwtStrategy } from './jwt.strategy';
import { LoginLockService } from './login-lock.service';
import { TokenService } from './token.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({
        secret: env.JWT_SECRET,
        signOptions: { algorithm: 'HS256' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    LoginLockService,
    JwtStrategy,
    GithubAuthGuard,
    {
      // passport-github2 explode sem credenciais: só registra quando configurado.
      provide: GithubStrategy,
      inject: [ENV],
      useFactory: (env: Env) =>
        env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
          ? new GithubStrategy(env)
          : null,
    },
  ],
  exports: [TokenService],
})
export class AuthModule {}
