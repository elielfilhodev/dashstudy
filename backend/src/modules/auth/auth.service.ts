import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { ENV, type Env } from '../../common/config/env';
import { MailService } from '../../common/mail/mail.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RegisterInput } from '../../common/schemas';
import { courseDefaults } from '../../common/utils/academic';
import { LoginLockService } from './login-lock.service';
import { TokenService, type TokenPair } from './token.service';

export const PASSWORD_ROUNDS = 12;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

function generateDisplayId(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly loginLock: LoginLockService,
    private readonly mail: MailService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async register(input: RegisterInput) {
    const [existingEmail, existingUsername] = await Promise.all([
      this.prisma.user.findUnique({ where: { email: input.email } }),
      this.prisma.user.findFirst({
        where: { username: { equals: input.username, mode: 'insensitive' } },
      }),
    ]);

    if (existingEmail)
      throw new BadRequestException('Já existe uma conta com este e-mail');
    if (existingUsername)
      throw new BadRequestException('Este username já está em uso');

    const hashedPassword = await bcrypt.hash(input.password, PASSWORD_ROUNDS);
    const displayId = await this.uniqueDisplayId();
    const courseData = courseDefaults(input.courseName);

    return this.prisma.$transaction(async (tx) => {
      const course = await tx.course.upsert({
        where: { normalizedName: courseData.normalizedName },
        update: {
          name: courseData.name,
          crestIcon: courseData.crestIcon,
          crestColor: courseData.crestColor,
          crestBackground: courseData.crestBackground,
        },
        create: courseData,
      });

      return tx.user.create({
        data: {
          name: input.name,
          username: input.username.toLowerCase(),
          displayId,
          email: input.email,
          password: hashedPassword,
          provider: 'email',
          gamification: { create: {} },
          academicProfile: {
            create: {
              academicLevel: input.academicLevel,
              startDate: new Date(`${input.startDate}T00:00:00.000Z`),
              currentSemester: input.currentSemester,
              courseId: course.id,
            },
          },
        },
        select: {
          id: true,
          name: true,
          username: true,
          displayId: true,
          email: true,
          createdAt: true,
        },
      });
    });
  }

  async login(email: string, password: string, ip: string): Promise<TokenPair> {
    if (this.loginLock.isLocked(ip, email)) {
      throw new UnauthorizedException(
        'Muitas tentativas. Tente novamente mais tarde.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, password: true },
    });

    const valid = await this.loginLock.comparePassword(
      user?.password ?? null,
      password,
    );
    if (!user || !valid) {
      this.loginLock.recordFailure(ip, email);
      throw new UnauthorizedException('E-mail ou senha inválidos');
    }

    this.loginLock.recordSuccess(ip, email);
    return this.tokens.issuePair(user.id);
  }

  refresh(refreshToken: string): Promise<TokenPair> {
    return this.tokens.rotate(refreshToken);
  }

  async logout(userId: string): Promise<{ ok: true }> {
    await this.tokens.revokeAll(userId);
    return { ok: true };
  }

  /** Sempre responde igual, exista ou não a conta (anti-enumeração de e-mails). */
  async forgotPassword(
    email: string,
  ): Promise<{ message: string; devUrl?: string }> {
    const generic = {
      message:
        'Se este e-mail estiver cadastrado, você receberá um link de recuperação.',
    };

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { email: true, name: true, password: true },
    });

    if (!user?.password) return generic;

    const token = randomBytes(32).toString('hex');

    await this.prisma.$transaction([
      this.prisma.verificationToken.deleteMany({
        where: { identifier: user.email },
      }),
      this.prisma.verificationToken.create({
        data: {
          identifier: user.email,
          token,
          expires: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
      }),
    ]);

    const { devUrl } = await this.mail.sendPasswordReset(
      user.email,
      user.name ?? 'Usuário',
      token,
    );

    return devUrl ? { ...generic, devUrl } : generic;
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ ok: true }> {
    const record = await this.prisma.verificationToken.findUnique({
      where: { token },
    });
    if (!record) throw new BadRequestException('Token inválido ou expirado');

    if (record.expires.getTime() <= Date.now()) {
      await this.prisma.verificationToken.delete({ where: { token } });
      throw new BadRequestException('Token inválido ou expirado');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: record.identifier },
      select: { id: true },
    });
    if (!user) throw new BadRequestException('Token inválido ou expirado');

    const hashedPassword = await bcrypt.hash(newPassword, PASSWORD_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      }),
      this.prisma.verificationToken.delete({ where: { token } }),
      // Uma troca de senha invalida todas as sessões abertas.
      this.prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
    ]);

    return { ok: true };
  }

  /** Cria ou vincula o usuário do GitHub e devolve um código de troca de uso único. */
  async githubSignIn(profile: {
    providerAccountId: string;
    email: string | null;
    name: string | null;
    username: string | null;
    image: string | null;
  }): Promise<string> {
    const existingAccount = await this.prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: 'github',
          providerAccountId: profile.providerAccountId,
        },
      },
      select: { userId: true },
    });

    if (existingAccount) {
      return this.tokens.issueExchangeCode(existingAccount.userId);
    }

    if (!profile.email) {
      throw new BadRequestException(
        'Sua conta do GitHub não expõe um e-mail público',
      );
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: profile.email },
      select: { id: true },
    });

    if (existingUser) {
      await this.linkGithubAccount(existingUser.id, profile.providerAccountId);
      await this.prisma.user.update({
        where: { id: existingUser.id },
        data: { githubUsername: profile.username },
      });
      return this.tokens.issueExchangeCode(existingUser.id);
    }

    const displayId = await this.uniqueDisplayId();
    const user = await this.prisma.user.create({
      data: {
        email: profile.email,
        name: profile.name ?? profile.username ?? 'Usuário',
        image: profile.image,
        provider: 'github',
        githubUsername: profile.username,
        username: await this.uniqueUsername(profile.username),
        displayId,
        emailVerified: new Date(),
        gamification: { create: {} },
      },
      select: { id: true },
    });

    await this.linkGithubAccount(user.id, profile.providerAccountId);
    return this.tokens.issueExchangeCode(user.id);
  }

  exchangeCode(code: string): Promise<TokenPair> {
    return this.tokens.consumeExchangeCode(code);
  }

  private linkGithubAccount(userId: string, providerAccountId: string) {
    return this.prisma.account.create({
      data: { userId, type: 'oauth', provider: 'github', providerAccountId },
    });
  }

  private async uniqueDisplayId(): Promise<string> {
    for (let i = 0; i < 10; i++) {
      const candidate = generateDisplayId();
      const collision = await this.prisma.user.findUnique({
        where: { displayId: candidate },
        select: { id: true },
      });
      if (!collision) return candidate;
    }
    throw new Error('Não foi possível gerar um displayId único');
  }

  private async uniqueUsername(
    preferred: string | null,
  ): Promise<string | null> {
    const base = (preferred ?? '').toLowerCase().replace(/[^a-z0-9._]/g, '');
    if (base.length < 3) return null;

    for (let i = 0; i < 10; i++) {
      const candidate = i === 0 ? base : `${base}${i}`;
      const taken = await this.prisma.user.findFirst({
        where: { username: { equals: candidate, mode: 'insensitive' } },
        select: { id: true },
      });
      if (!taken) return candidate;
    }
    return null;
  }
}
