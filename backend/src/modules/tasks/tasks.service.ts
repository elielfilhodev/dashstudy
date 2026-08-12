import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { CreateTaskInput, UpdateTaskInput } from '../../common/schemas';
import { assertOwnership } from '../../common/utils/ownership';

const subjectInclude = { subject: { select: { id: true, name: true } } };

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.task.findMany({
      where: { userId },
      include: subjectInclude,
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  create(userId: string, input: CreateTaskInput) {
    return this.prisma.task.create({
      data: { ...input, userId },
      include: subjectInclude,
    });
  }

  async update(userId: string, id: string, input: UpdateTaskInput) {
    await this.assertOwned(userId, id);
    return this.prisma.task.update({
      where: { id },
      data: input,
      include: subjectInclude,
    });
  }

  async remove(userId: string, id: string) {
    await this.assertOwned(userId, id);
    await this.prisma.task.delete({ where: { id } });
  }

  private async assertOwned(userId: string, id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      select: { userId: true },
    });
    assertOwnership(task, userId, 'Tarefa');
  }
}
