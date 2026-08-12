import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ENV, type Env } from '../../common/config/env';
import { CurrentUser, Public, SkipEnvelope } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  exchangeCodeSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
} from '../../common/schemas';
import { AuthService } from './auth.service';
import { GithubAuthGuard } from './github-auth.guard';
import type { GithubProfile } from './github.strategy';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Public()
  @Post('register')
  register(@Body(new ZodValidationPipe(registerSchema)) body: unknown) {
    return this.auth.register(body as never);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  login(
    @Body(new ZodValidationPipe(loginSchema))
    body: { email: string; password: string },
    @Req() req: Request,
  ) {
    return this.auth.login(body.email, body.password, req.ip ?? 'unknown');
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(
    @Body(new ZodValidationPipe(refreshSchema)) body: { refreshToken: string },
  ) {
    return this.auth.refresh(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(200)
  logout(@CurrentUser() userId: string) {
    return this.auth.logout(userId);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(200)
  forgotPassword(
    @Body(new ZodValidationPipe(forgotPasswordSchema)) body: { email: string },
  ) {
    return this.auth.forgotPassword(body.email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(200)
  resetPassword(
    @Body(new ZodValidationPipe(resetPasswordSchema))
    body: {
      token: string;
      newPassword: string;
    },
  ) {
    return this.auth.resetPassword(body.token, body.newPassword);
  }

  @Public()
  @Post('exchange')
  @HttpCode(200)
  exchange(
    @Body(new ZodValidationPipe(exchangeCodeSchema)) body: { code: string },
  ) {
    return this.auth.exchangeCode(body.code);
  }

  @Public()
  @Get('github')
  @UseGuards(GithubAuthGuard)
  @SkipEnvelope()
  githubStart() {
    // O guard redireciona ao GitHub; nada a fazer aqui.
  }

  @Public()
  @Get('github/callback')
  @UseGuards(GithubAuthGuard)
  @SkipEnvelope()
  async githubCallback(@Req() req: Request, @Res() res: Response) {
    const profile = req.user as unknown as GithubProfile;
    try {
      const code = await this.auth.githubSignIn(profile);
      res.redirect(
        `${this.env.FRONTEND_URL}/api/auth/callback?code=${encodeURIComponent(code)}`,
      );
    } catch {
      res.redirect(`${this.env.FRONTEND_URL}/login?error=oauth`);
    }
  }
}
