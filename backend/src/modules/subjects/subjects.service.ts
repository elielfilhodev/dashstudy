import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { CreateSubjectInput } from '../../common/schemas';
import { assertOwnership } from '../../common/utils/ownership';

@Injectable()
export class SubjectsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.subject.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  create(userId: string, input: CreateSubjectInput) {
    return this.prisma.subject.create({ data: { ...input, userId } });
  }

  async updateProgress(userId: string, id: string, progress: number) {
    await this.assertOwned(userId, id);
    return this.prisma.subject.update({ where: { id }, data: { progress } });
  }

  async remove(userId: string, id: string) {
    await this.assertOwned(userId, id);
    await this.prisma.subject.delete({ where: { id } });
  }

  private async assertOwned(userId: string, id: string) {
    const subject = await this.prisma.subject.findUnique({
      where: { id },
      select: { userId: true },
    });
    assertOwnership(subject, userId, 'Matéria');
  }
}
