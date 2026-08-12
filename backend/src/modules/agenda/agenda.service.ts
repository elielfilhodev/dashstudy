import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type {
  CreateAgendaItemInput,
  UpdateAgendaItemInput,
} from '../../common/schemas';
import { assertOwnership } from '../../common/utils/ownership';

const subjectInclude = { subject: { select: { id: true, name: true } } };

@Injectable()
export class AgendaService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.agendaItem.findMany({
      where: { userId },
      include: subjectInclude,
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
    });
  }

  create(userId: string, input: CreateAgendaItemInput) {
    return this.prisma.agendaItem.create({
      data: { ...input, userId },
      include: subjectInclude,
    });
  }

  async update(userId: string, id: string, input: UpdateAgendaItemInput) {
    await this.assertOwned(userId, id);
    return this.prisma.agendaItem.update({
      where: { id },
      data: input,
      include: subjectInclude,
    });
  }

  async remove(userId: string, id: string) {
    await this.assertOwned(userId, id);
    await this.prisma.agendaItem.delete({ where: { id } });
  }

  private async assertOwned(userId: string, id: string) {
    const item = await this.prisma.agendaItem.findUnique({
      where: { id },
      select: { userId: true },
    });
    assertOwnership(item, userId, 'Item de agenda');
  }
}
