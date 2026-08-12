import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { SendMessageInput } from '../../common/schemas';
import {
  chatUserSelect,
  isUserOnline,
  serializeMessage,
} from '../../common/utils/serialize';
import { FriendsService } from '../friends/friends.service';

const PAGE_SIZE = 50;
const messageInclude = { sender: { select: chatUserSelect } };

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly friends: FriendsService,
  ) {}

  /**
   * Conversas do usuário: DMs com amigos + grupos.
   * As últimas mensagens vêm em duas queries `DISTINCT ON` em vez de uma por
   * conversa, e os não lidos numa agregação — sem N+1.
   */
  async conversations(userId: string) {
    const [sent, received, memberships] = await Promise.all([
      this.prisma.friendship.findMany({
        where: { senderId: userId, status: 'ACCEPTED' },
        select: { receiver: { select: chatUserSelect } },
      }),
      this.prisma.friendship.findMany({
        where: { receiverId: userId, status: 'ACCEPTED' },
        select: { sender: { select: chatUserSelect } },
      }),
      this.prisma.chatGroupMember.findMany({
        where: { userId },
        select: {
          group: {
            include: {
              admin: { select: chatUserSelect },
              coAdmin: { select: chatUserSelect },
              members: { include: { user: { select: chatUserSelect } } },
            },
          },
        },
      }),
    ]);

    const friends = [
      ...sent.map((f) => f.receiver),
      ...received.map((f) => f.sender),
    ];
    const friendIds = friends.map((f) => f.id);
    const groups = memberships.map((m) => m.group);
    const groupIds = groups.map((g) => g.id);

    const [lastMessages, unreadByFriend] = await Promise.all([
      this.lastMessages(userId, friendIds, groupIds),
      this.unreadByFriend(userId, friendIds),
    ]);

    const directs = friends.map((friend) => ({
      type: 'direct' as const,
      friend: { ...friend, online: isUserOnline(friend.lastSeenAt) },
      lastMessage: lastMessages.byPartner.get(friend.id) ?? null,
      unread: unreadByFriend.get(friend.id) ?? 0,
    }));

    const groupConversations = groups.map((group) => ({
      type: 'group' as const,
      group: this.serializeGroupRow(group),
      lastMessage: lastMessages.byGroup.get(group.id) ?? null,
      unread: 0,
    }));

    return [...directs, ...groupConversations].sort((a, b) =>
      (b.lastMessage?.createdAt ?? '0').localeCompare(
        a.lastMessage?.createdAt ?? '0',
      ),
    );
  }

  async directMessages(userId: string, otherId: string, cursor?: string) {
    await this.assertDirectAllowed(userId, otherId);

    const messages = await this.prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId, recipientId: otherId },
          { senderId: otherId, recipientId: userId },
        ],
      },
      include: messageInclude,
      orderBy: { createdAt: 'asc' },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: PAGE_SIZE,
    });

    return messages.map(serializeMessage);
  }

  async sendDirect(userId: string, otherId: string, input: SendMessageInput) {
    await this.assertDirectAllowed(userId, otherId);

    const message = await this.prisma.message.create({
      data: {
        content: input.content,
        attachmentUrl: input.attachmentUrl ?? null,
        attachmentType: input.attachmentType ?? null,
        attachmentName: input.attachmentName ?? null,
        senderId: userId,
        recipientId: otherId,
      },
      include: messageInclude,
    });

    return serializeMessage(message);
  }

  async listGroups(userId: string) {
    const memberships = await this.prisma.chatGroupMember.findMany({
      where: { userId },
      select: {
        group: {
          include: {
            admin: { select: chatUserSelect },
            coAdmin: { select: chatUserSelect },
            members: { include: { user: { select: chatUserSelect } } },
          },
        },
      },
    });

    return memberships.map((m) => this.serializeGroupRow(m.group));
  }

  async createGroup(userId: string, name: string, description: string | null) {
    const group = await this.prisma.chatGroup.create({
      data: {
        name,
        description,
        adminId: userId,
        members: { create: { userId } },
      },
      include: {
        admin: { select: chatUserSelect },
        coAdmin: { select: chatUserSelect },
        members: { include: { user: { select: chatUserSelect } } },
      },
    });

    return this.serializeGroupRow(group);
  }

  async getGroup(userId: string, groupId: string) {
    const group = await this.loadGroupAsMember(groupId, userId);
    return this.serializeGroupRow(group);
  }

  async updateGroup(
    userId: string,
    groupId: string,
    input: {
      name?: string;
      description?: string | null;
      coAdminId?: string | null;
    },
  ) {
    const group = await this.loadGroupAsMember(groupId, userId);
    if (group.adminId !== userId) throw new ForbiddenException('Acesso negado');

    if (input.coAdminId != null) {
      const isMember = group.members.some((m) => m.userId === input.coAdminId);
      if (!isMember)
        throw new BadRequestException('Co-admin deve ser membro do grupo');
      if (input.coAdminId === userId) {
        throw new BadRequestException('Admin não pode ser co-admin');
      }
    }

    const updated = await this.prisma.chatGroup.update({
      where: { id: groupId },
      data: input,
      include: {
        admin: { select: chatUserSelect },
        coAdmin: { select: chatUserSelect },
        members: { include: { user: { select: chatUserSelect } } },
      },
    });

    return this.serializeGroupRow(updated);
  }

  async deleteGroup(userId: string, groupId: string) {
    const group = await this.loadGroupAsMember(groupId, userId);
    if (group.adminId !== userId) throw new ForbiddenException('Acesso negado');
    await this.prisma.chatGroup.delete({ where: { id: groupId } });
  }

  async groupMessages(userId: string, groupId: string, cursor?: string) {
    await this.assertGroupMember(groupId, userId);

    const messages = await this.prisma.message.findMany({
      where: { groupId },
      include: messageInclude,
      orderBy: { createdAt: 'asc' },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: PAGE_SIZE,
    });

    return messages.map(serializeMessage);
  }

  async sendGroupMessage(
    userId: string,
    groupId: string,
    input: SendMessageInput,
  ) {
    await this.assertGroupMember(groupId, userId);

    const message = await this.prisma.message.create({
      data: {
        content: input.content,
        attachmentUrl: input.attachmentUrl ?? null,
        attachmentType: input.attachmentType ?? null,
        attachmentName: input.attachmentName ?? null,
        senderId: userId,
        groupId,
      },
      include: messageInclude,
    });

    return serializeMessage(message);
  }

  async listMembers(userId: string, groupId: string) {
    await this.assertGroupMember(groupId, userId);

    const members = await this.prisma.chatGroupMember.findMany({
      where: { groupId },
      include: { user: { select: chatUserSelect } },
    });

    return members.map((m) => ({
      id: m.id,
      groupId: m.groupId,
      userId: m.userId,
      user: { ...m.user, online: isUserOnline(m.user.lastSeenAt) },
      joinedAt: m.joinedAt.toISOString(),
    }));
  }

  async addMember(userId: string, groupId: string, targetId: string) {
    const group = await this.loadGroup(groupId);
    if (group.adminId !== userId && group.coAdminId !== userId) {
      throw new ForbiddenException('Acesso negado');
    }

    const areFriends = await this.friends.areFriends(userId, targetId);
    if (!areFriends) {
      throw new BadRequestException('Só é possível adicionar amigos ao grupo');
    }

    const existing = await this.prisma.chatGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId: targetId } },
      select: { id: true },
    });
    if (existing) throw new BadRequestException('Usuário já é membro do grupo');

    const member = await this.prisma.chatGroupMember.create({
      data: { groupId, userId: targetId },
      include: { user: { select: chatUserSelect } },
    });

    return {
      id: member.id,
      groupId: member.groupId,
      userId: member.userId,
      user: { ...member.user, online: isUserOnline(member.user.lastSeenAt) },
      joinedAt: member.joinedAt.toISOString(),
    };
  }

  async removeMember(userId: string, groupId: string, targetId: string) {
    const group = await this.loadGroup(groupId);

    const canRemove =
      group.adminId === userId ||
      group.coAdminId === userId ||
      userId === targetId;
    if (!canRemove) throw new ForbiddenException('Acesso negado');

    // O admin só sai do grupo apagando o grupo.
    if (targetId === group.adminId) {
      throw new BadRequestException('O admin não pode ser removido do grupo');
    }

    const member = await this.prisma.chatGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId: targetId } },
      select: { id: true },
    });
    if (!member) throw new NotFoundException('Membro não encontrado');

    await this.prisma.$transaction([
      this.prisma.chatGroupMember.delete({ where: { id: member.id } }),
      ...(group.coAdminId === targetId
        ? [
            this.prisma.chatGroup.update({
              where: { id: groupId },
              data: { coAdminId: null },
            }),
          ]
        : []),
    ]);
  }

  /** Alterna o papel de co-admin do membro alvo (apenas o admin pode). */
  async toggleCoAdmin(userId: string, groupId: string, targetId: string) {
    const group = await this.loadGroup(groupId);
    if (group.adminId !== userId) throw new ForbiddenException('Acesso negado');
    if (targetId === userId)
      throw new BadRequestException('Admin não pode ser co-admin');

    const member = await this.prisma.chatGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId: targetId } },
      select: { id: true },
    });
    if (!member) throw new NotFoundException('Membro não encontrado');

    const updated = await this.prisma.chatGroup.update({
      where: { id: groupId },
      data: { coAdminId: group.coAdminId === targetId ? null : targetId },
      select: { coAdminId: true },
    });

    return updated;
  }

  /** Quantas mensagens cada amigo enviou ao usuário, numa única agregação. */
  private async unreadByFriend(
    userId: string,
    friendIds: string[],
  ): Promise<Map<string, number>> {
    if (friendIds.length === 0) return new Map();

    const rows = await this.prisma.message.groupBy({
      by: ['senderId'],
      where: { recipientId: userId, senderId: { in: friendIds } },
      _count: { _all: true },
    });

    return new Map(rows.map((row) => [row.senderId, row._count._all]));
  }

  private async lastMessages(
    userId: string,
    friendIds: string[],
    groupIds: string[],
  ) {
    const byPartner = new Map<string, ReturnType<typeof serializeMessage>>();
    const byGroup = new Map<string, ReturnType<typeof serializeMessage>>();
    if (friendIds.length === 0 && groupIds.length === 0)
      return { byPartner, byGroup };

    const [dmRows, groupRows] = await Promise.all([
      friendIds.length > 0
        ? this.prisma.$queryRaw<
            Array<{ id: string; partnerId: string }>
          >(Prisma.sql`
            SELECT DISTINCT ON (partner."partnerId") partner.id, partner."partnerId"
            FROM (
              SELECT m.id, m."createdAt",
                CASE WHEN m."senderId" = ${userId} THEN m."recipientId" ELSE m."senderId" END
                  AS "partnerId"
              FROM "Message" m
              WHERE m."groupId" IS NULL
                AND (m."senderId" = ${userId} OR m."recipientId" = ${userId})
            ) partner
            WHERE partner."partnerId" = ANY(${friendIds})
            ORDER BY partner."partnerId", partner."createdAt" DESC
          `)
        : Promise.resolve<Array<{ id: string; partnerId: string }>>([]),
      groupIds.length > 0
        ? this.prisma.$queryRaw<
            Array<{ id: string; groupId: string }>
          >(Prisma.sql`
            SELECT DISTINCT ON ("groupId") id, "groupId"
            FROM "Message"
            WHERE "groupId" = ANY(${groupIds})
            ORDER BY "groupId", "createdAt" DESC
          `)
        : Promise.resolve<Array<{ id: string; groupId: string }>>([]),
    ]);

    const ids = [...dmRows.map((r) => r.id), ...groupRows.map((r) => r.id)];
    if (ids.length === 0) return { byPartner, byGroup };

    const messages = await this.prisma.message.findMany({
      where: { id: { in: ids } },
      include: messageInclude,
    });
    const serialized = new Map(
      messages.map((m) => [m.id, serializeMessage(m)]),
    );

    for (const row of dmRows) {
      const message = serialized.get(row.id);
      if (message) byPartner.set(row.partnerId, message);
    }
    for (const row of groupRows) {
      const message = serialized.get(row.id);
      if (message) byGroup.set(row.groupId, message);
    }

    return { byPartner, byGroup };
  }

  private async assertDirectAllowed(userId: string, otherId: string) {
    if (userId === otherId) {
      throw new BadRequestException('Não é possível conversar consigo mesmo');
    }
    const areFriends = await this.friends.areFriends(userId, otherId);
    if (!areFriends) throw new ForbiddenException('Acesso negado');
  }

  private async loadGroup(groupId: string) {
    const group = await this.prisma.chatGroup.findUnique({
      where: { id: groupId },
    });
    if (!group) throw new NotFoundException('Grupo não encontrado');
    return group;
  }

  private async loadGroupAsMember(groupId: string, userId: string) {
    const group = await this.prisma.chatGroup.findUnique({
      where: { id: groupId },
      include: {
        admin: { select: chatUserSelect },
        coAdmin: { select: chatUserSelect },
        members: { include: { user: { select: chatUserSelect } } },
      },
    });
    if (!group) throw new NotFoundException('Grupo não encontrado');
    if (!group.members.some((m) => m.userId === userId)) {
      throw new ForbiddenException('Acesso negado');
    }
    return group;
  }

  private async assertGroupMember(groupId: string, userId: string) {
    const group = await this.prisma.chatGroup.findUnique({
      where: { id: groupId },
      select: { id: true },
    });
    if (!group) throw new NotFoundException('Grupo não encontrado');

    const member = await this.prisma.chatGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: { id: true },
    });
    if (!member) throw new ForbiddenException('Acesso negado');
  }

  private serializeGroupRow(group: {
    id: string;
    name: string;
    description: string | null;
    adminId: string;
    coAdminId: string | null;
    admin: { lastSeenAt: Date | null };
    coAdmin: { lastSeenAt: Date | null } | null;
    members: Array<{
      id: string;
      groupId: string;
      userId: string;
      joinedAt: Date;
      user: { lastSeenAt: Date | null };
    }>;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: group.id,
      name: group.name,
      description: group.description,
      adminId: group.adminId,
      coAdminId: group.coAdminId,
      admin: { ...group.admin, online: isUserOnline(group.admin.lastSeenAt) },
      coAdmin: group.coAdmin
        ? { ...group.coAdmin, online: isUserOnline(group.coAdmin.lastSeenAt) }
        : null,
      members: group.members.map((m) => ({
        id: m.id,
        groupId: m.groupId,
        userId: m.userId,
        user: { ...m.user, online: isUserOnline(m.user.lastSeenAt) },
        joinedAt: m.joinedAt.toISOString(),
      })),
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
    };
  }
}
