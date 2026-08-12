import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { serializeAcademicProfile } from '../../common/utils/academic';
import {
  isUserOnline,
  serializeBookListItem,
} from '../../common/utils/serialize';
import { FriendsService } from './friends.service';

const emptyGamification = {
  xp: 0,
  totalCompletions: 0,
  streakDays: 0,
  bestStreak: 0,
  achievements: [] as Array<{ key: string; unlockedAt: string }>,
};

@Injectable()
export class FriendProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly friends: FriendsService,
  ) {}

  async profile(viewerId: string, friendId: string) {
    await this.assertFriend(viewerId, friendId);

    const user = await this.prisma.user.findUnique({
      where: { id: friendId },
      select: {
        id: true,
        name: true,
        username: true,
        displayId: true,
        image: true,
        bannerUrl: true,
        bannerMime: true,
        lastSeenAt: true,
        presenceStatus: true,
        academicProfile: { include: { course: true } },
        gamification: {
          select: {
            xp: true,
            totalCompletions: true,
            streakDays: true,
            bestStreak: true,
            achievements: {
              select: { key: true, unlockedAt: true },
              orderBy: { unlockedAt: 'asc' },
            },
          },
        },
      },
    });
    if (!user) throw new NotFoundException('Utilizador não encontrado');

    const online = isUserOnline(user.lastSeenAt);

    return {
      user: {
        id: user.id,
        name: user.name ?? 'Usuário',
        username: user.username,
        displayId: user.displayId,
        image: user.image,
        bannerHref: user.bannerMime
          ? `/api/friends/profile/${user.id}/banner`
          : user.bannerUrl,
        online,
        presenceStatus: online ? user.presenceStatus : 'OFFLINE',
        lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
        academic: serializeAcademicProfile(user.academicProfile),
      },
      gamification: user.gamification ?? emptyGamification,
    };
  }

  async banner(viewerId: string, friendId: string) {
    await this.assertFriend(viewerId, friendId);

    const user = await this.prisma.user.findUnique({
      where: { id: friendId },
      select: { bannerBlob: true, bannerMime: true },
    });
    if (!user) throw new NotFoundException('Utilizador não encontrado');
    if (!user.bannerBlob || !user.bannerMime) return null;

    return { blob: Buffer.from(user.bannerBlob), mime: user.bannerMime };
  }

  /** Livros do amigo: contagem de anotações privadas fica oculta. */
  async books(viewerId: string, friendId: string) {
    await this.assertFriend(viewerId, friendId);

    const books = await this.prisma.book.findMany({
      where: { userId: friendId },
      select: {
        id: true,
        title: true,
        author: true,
        isbn: true,
        rating: true,
        coverUrl: true,
        coverMime: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { comments: true } },
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return books.map((book) =>
      serializeBookListItem(
        { ...book, _count: { notes: 0, comments: book._count.comments } },
        { hideNotesCount: true },
      ),
    );
  }

  private async assertFriend(viewerId: string, friendId: string) {
    if (!friendId || friendId === viewerId)
      throw new ForbiddenException('Acesso negado');
    const areFriends = await this.friends.areFriends(viewerId, friendId);
    if (!areFriends) throw new ForbiddenException('Acesso negado');
  }
}
