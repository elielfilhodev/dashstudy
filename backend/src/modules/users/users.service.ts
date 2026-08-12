import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { UpdateUserInput } from '../../common/schemas';
import {
  courseDefaults,
  serializeAcademicProfile,
} from '../../common/utils/academic';
import { PASSWORD_ROUNDS } from '../auth/auth.service';

export const BANNER_MAX_BYTES = 4 * 1024 * 1024;
export const BANNER_ALLOWED_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async update(userId: string, input: UpdateUserInput) {
    switch (input.action) {
      case 'username':
        return this.updateUsername(userId, input.username);
      case 'avatar':
        return this.prisma.user.update({
          where: { id: userId },
          data: { image: input.image },
          select: { image: true },
        });
      case 'banner-url':
        return this.updateBannerUrl(userId, input.bannerUrl);
      case 'academic-profile':
        return this.updateAcademicProfile(userId, input);
    }
  }

  private async updateUsername(userId: string, username: string) {
    const taken = await this.prisma.user.findFirst({
      where: {
        username: { equals: username, mode: 'insensitive' },
        NOT: { id: userId },
      },
      select: { id: true },
    });
    if (taken) throw new BadRequestException('Este username já está em uso');

    return this.prisma.user.update({
      where: { id: userId },
      data: { username: username.toLowerCase() },
      select: { username: true },
    });
  }

  private async updateBannerUrl(userId: string, bannerUrl: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { bannerUrl, bannerBlob: null, bannerMime: null },
    });
    return { bannerUrl };
  }

  private async updateAcademicProfile(
    userId: string,
    input: Extract<UpdateUserInput, { action: 'academic-profile' }>,
  ) {
    const courseData = courseDefaults(input.courseName);
    const startDate = new Date(`${input.startDate}T00:00:00.000Z`);

    const profile = await this.prisma.$transaction(async (tx) => {
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

      const values = {
        courseId: course.id,
        academicLevel: input.academicLevel,
        startDate,
        currentSemester: input.currentSemester,
      };

      return tx.academicProfile.upsert({
        where: { userId },
        update: values,
        create: { userId, ...values },
        include: { course: true },
      });
    });

    return serializeAcademicProfile(profile);
  }

  async getBanner(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { bannerBlob: true, bannerMime: true },
    });
    if (!user?.bannerBlob || !user.bannerMime) return null;
    return { blob: Buffer.from(user.bannerBlob), mime: user.bannerMime };
  }

  async setBanner(userId: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Arquivo não encontrado');
    if (!BANNER_ALLOWED_MIME.includes(file.mimetype)) {
      throw new BadRequestException(
        'Formato inválido. Use JPG, PNG, WebP ou GIF',
      );
    }
    if (file.size > BANNER_MAX_BYTES) {
      throw new BadRequestException('Arquivo muito grande (máx 4 MB)');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        bannerBlob: file.buffer,
        bannerMime: file.mimetype,
        bannerUrl: null,
      },
    });

    return { bannerHref: '/api/user/banner' };
  }

  async deleteBanner(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { bannerBlob: null, bannerMime: null, bannerUrl: null },
    });
    return { removed: true };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });

    // Conta criada só via OAuth não tem senha para trocar.
    if (!user?.password) throw new ForbiddenException('Acesso negado');

    const matches = await bcrypt.compare(currentPassword, user.password);
    if (!matches) throw new BadRequestException('Senha atual incorreta');

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: await bcrypt.hash(newPassword, PASSWORD_ROUNDS) },
    });

    return { message: 'Senha alterada com sucesso' };
  }

  /** Contagem de tarefas concluídas por dia nos últimos 365 dias. */
  async activity(userId: string): Promise<Record<string, number>> {
    const since = new Date();
    since.setFullYear(since.getFullYear() - 1);

    const tasks = await this.prisma.task.findMany({
      where: { userId, done: true, updatedAt: { gte: since } },
      select: { updatedAt: true },
    });

    const counts: Record<string, number> = {};
    for (const task of tasks) {
      const day = task.updatedAt.toISOString().slice(0, 10);
      counts[day] = (counts[day] ?? 0) + 1;
    }
    return counts;
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        displayId: true,
        image: true,
        provider: true,
        githubUsername: true,
        bannerUrl: true,
        bannerMime: true,
        createdAt: true,
        academicProfile: { include: { course: true } },
      },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const { academicProfile, bannerMime, ...rest } = user;
    return {
      ...rest,
      bannerHref: bannerMime ? '/api/user/banner' : (user.bannerUrl ?? null),
      academic: serializeAcademicProfile(academicProfile),
    };
  }
}
