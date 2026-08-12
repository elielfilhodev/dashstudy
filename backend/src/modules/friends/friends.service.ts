import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { serializeAcademicProfile } from '../../common/utils/academic';
import { isUserOnline } from '../../common/utils/serialize';

const friendUserSelect = {
  id: true,
  name: true,
  username: true,
  displayId: true,
  image: true,
  lastSeenAt: true,
  presenceStatus: true,
  academicProfile: { include: { course: true } },
  gamification: { select: { xp: true } },
} as const;

type FriendUserRow = {
  id: string;
  name: string | null;
  username: string | null;
  displayId: string;
  image: string | null;
  lastSeenAt: Date | null;
  presenceStatus: string;
  academicProfile: Parameters<typeof serializeAcademicProfile>[0];
  gamification: { xp: number } | null;
};

function serializeFriend(user: FriendUserRow) {
  const online = isUserOnline(user.lastSeenAt);
  return {
    id: user.id,
    name: user.name ?? 'Usuário',
    username: user.username,
    displayId: user.displayId,
    image: user.image,
    online,
    presenceStatus: online ? user.presenceStatus : 'OFFLINE',
    lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
    academic: serializeAcademicProfile(user.academicProfile),
    xp: user.gamification?.xp ?? 0,
  };
}

@Injectable()
export class FriendsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const [sent, received] = await Promise.all([
      this.prisma.friendship.findMany({
        where: { senderId: userId },
        include: { receiver: { select: friendUserSelect } },
      }),
      this.prisma.friendship.findMany({
        where: { receiverId: userId },
        include: { sender: { select: friendUserSelect } },
      }),
    ]);

    const friends = [
      ...sent
        .filter((f) => f.status === 'ACCEPTED')
        .map((f) => ({
          ...serializeFriend(f.receiver),
          friendshipId: f.id,
          direction: 'sent' as const,
        })),
      ...received
        .filter((f) => f.status === 'ACCEPTED')
        .map((f) => ({
          ...serializeFriend(f.sender),
          friendshipId: f.id,
          direction: 'received' as const,
        })),
    ].sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0));

    const pendingReceived = received
      .filter((f) => f.status === 'PENDING')
      .map((f) => ({
        ...serializeFriend(f.sender),
        friendshipId: f.id,
        direction: 'received' as const,
      }));

    const pendingSent = sent
      .filter((f) => f.status === 'PENDING')
      .map((f) => ({
        ...serializeFriend(f.receiver),
        friendshipId: f.id,
        direction: 'sent' as const,
      }));

    return { friends, pendingReceived, pendingSent };
  }

  async request(userId: string, username: string) {
    const target = await this.prisma.user.findFirst({
      where: {
        username: { equals: username, mode: 'insensitive' },
        NOT: { id: userId },
      },
      select: {
        id: true,
        name: true,
        username: true,
        displayId: true,
        image: true,
      },
    });
    if (!target) throw new BadRequestException('Usuário não encontrado');

    const existing = await this.findBetween(userId, target.id);
    if (existing) {
      if (existing.status === 'ACCEPTED')
        throw new BadRequestException('Vocês já são amigos');
      if (existing.status === 'PENDING')
        throw new BadRequestException('Solicitação já enviada');
      throw new BadRequestException('Não foi possível enviar solicitação');
    }

    const friendship = await this.prisma.friendship.create({
      data: { senderId: userId, receiverId: target.id },
    });

    return { friendship, target };
  }

  async accept(userId: string, id: string) {
    const friendship = await this.load(id, userId, 'Solicitação');
    // Só quem recebeu o pedido pode aceitá-lo.
    if (friendship.receiverId !== userId)
      throw new ForbiddenException('Acesso negado');
    return this.prisma.friendship.update({
      where: { id },
      data: { status: 'ACCEPTED' },
    });
  }

  async block(userId: string, id: string) {
    await this.load(id, userId, 'Solicitação');
    return this.prisma.friendship.update({
      where: { id },
      data: { status: 'BLOCKED' },
    });
  }

  async remove(userId: string, id: string, entity = 'Amizade') {
    await this.load(id, userId, entity);
    await this.prisma.friendship.delete({ where: { id } });
  }

  /** Amizade ACEITA em qualquer direção (o próprio usuário conta como "amigo"). */
  async areFriends(a: string, b: string): Promise<boolean> {
    if (a === b) return true;
    const friendship = await this.prisma.friendship.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { senderId: a, receiverId: b },
          { senderId: b, receiverId: a },
        ],
      },
      select: { id: true },
    });
    return friendship !== null;
  }

  private findBetween(a: string, b: string) {
    return this.prisma.friendship.findFirst({
      where: {
        OR: [
          { senderId: a, receiverId: b },
          { senderId: b, receiverId: a },
        ],
      },
    });
  }

  private async load(id: string, userId: string, entity: string) {
    const friendship = await this.prisma.friendship.findUnique({
      where: { id },
    });
    if (!friendship) throw new NotFoundException(`${entity} não encontrado`);
    if (friendship.senderId !== userId && friendship.receiverId !== userId) {
      throw new ForbiddenException('Acesso negado');
    }
    return friendship;
  }
}
