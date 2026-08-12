import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { CreateGoalInput } from '../../common/schemas';
import { assertOwnership } from '../../common/utils/ownership';

@Injectable()
export class GoalsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.goal.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  create(userId: string, input: CreateGoalInput) {
    return this.prisma.goal.create({ data: { ...input, userId } });
  }

  async updateProgress(userId: string, id: string, done: number) {
    await this.assertOwned(userId, id);
    return this.prisma.goal.update({ where: { id }, data: { done } });
  }

  async remove(userId: string, id: string) {
    await this.assertOwned(userId, id);
    await this.prisma.goal.delete({ where: { id } });
  }

  private async assertOwned(userId: string, id: string) {
    const goal = await this.prisma.goal.findUnique({
      where: { id },
      select: { userId: true },
    });
    assertOwnership(goal, userId, 'Meta');
  }
}
