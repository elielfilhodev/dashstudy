import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { ENV, type Env } from '../../common/config/env';
import { PrismaService } from '../../common/prisma/prisma.service';

export type TokenPair = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: 'Bearer';
};

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Emite um par access/refresh e persiste apenas o hash do refresh. */
  async issuePair(userId: string): Promise<TokenPair> {
    const expiresIn = this.env.JWT_ACCESS_MINUTES * 60;
    const accessToken = await this.jwt.signAsync(
      { sub: userId, typ: 'access' },
      { expiresIn },
    );

    const refreshToken = randomBytes(32).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(
          Date.now() + this.env.JWT_REFRESH_DAYS * 86_400_000,
        ),
      },
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: expiresIn,
      token_type: 'Bearer',
    };
  }

  /** Consome (rotaciona) um refresh token e devolve um novo par. */
  async rotate(refreshToken: string): Promise<TokenPair> {
    const tokenHash = sha256(refreshToken);
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!record) throw new UnauthorizedException('Não autenticado');

    await this.prisma.refreshToken.delete({ where: { id: record.id } });

    if (record.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Não autenticado');
    }

    return this.issuePair(record.userId);
  }

  async revokeAll(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }

  /** Código de uso único (60s) para o handoff do OAuth ao frontend. */
  async issueExchangeCode(userId: string): Promise<string> {
    const code = randomBytes(32).toString('base64url');
    await this.prisma.authExchangeCode.create({
      data: {
        userId,
        codeHash: sha256(code),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    return code;
  }

  async consumeExchangeCode(code: string): Promise<TokenPair> {
    const codeHash = sha256(code);
    const record = await this.prisma.authExchangeCode.findUnique({
      where: { codeHash },
    });

    if (!record) throw new UnauthorizedException('Código inválido ou expirado');

    await this.prisma.authExchangeCode.delete({ where: { id: record.id } });

    if (record.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Código inválido ou expirado');
    }

    return this.issuePair(record.userId);
  }
}
