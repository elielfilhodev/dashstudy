import { db } from "@/lib/db"
import { requireAuth } from "@/lib/session"
import { ok, serverError } from "@/lib/api-response"

const ONLINE_MS = 5 * 60 * 1000

function isOnline(d: Date | null) {
  return d ? Date.now() - d.getTime() < ONLINE_MS : false
}

const userSelect = {
  id: true,
  name: true,
  username: true,
  displayId: true,
  image: true,
  lastSeenAt: true,
} as const

// GET /api/chat/conversations — list DMs (from friends) + groups the user belongs to
export async function GET() {
  const { userId, error } = await requireAuth()
  if (error) return error

  try {
    // --- friends (accepted) ---
    const [sentFs, receivedFs] = await Promise.all([
      db.friendship.findMany({
        where: { senderId: userId, status: "ACCEPTED" },
        include: { receiver: { select: userSelect } },
      }),
      db.friendship.findMany({
        where: { receiverId: userId, status: "ACCEPTED" },
        include: { sender: { select: userSelect } },
      }),
    ])

    const friendUsers = [
      ...sentFs.map((f) => f.receiver),
      ...receivedFs.map((f) => f.sender),
    ]

    // last DM per friend
    const dmConversations = await Promise.all(
      friendUsers.map(async (friend) => {
        const last = await db.message.findFirst({
          where: {
            OR: [
              { senderId: userId, recipientId: friend.id },
              { senderId: friend.id, recipientId: userId },
            ],
          },
          orderBy: { createdAt: "desc" },
          include: { sender: { select: userSelect } },
        })

        const unread = await db.message.count({
          where: { senderId: friend.id, recipientId: userId },
        })

        return {
          type: "direct" as const,
          friend: { ...friend, online: isOnline(friend.lastSeenAt) },
          lastMessage: last
            ? {
                id: last.id,
                content: last.content,
                senderId: last.senderId,
                sender: { ...last.sender, online: isOnline(last.sender.lastSeenAt) },
                recipientId: last.recipientId,
                groupId: last.groupId,
                createdAt: last.createdAt.toISOString(),
              }
            : null,
          unread,
        }
      })
    )

    // --- groups ---
    const memberships = await db.chatGroupMember.findMany({
      where: { userId },
      include: {
        group: {
          include: {
            admin: { select: userSelect },
            coAdmin: { select: userSelect },
            members: {
              include: { user: { select: userSelect } },
            },
          },
        },
      },
    })

    const groupConversations = await Promise.all(
      memberships.map(async ({ group }) => {
        const last = await db.message.findFirst({
          where: { groupId: group.id },
          orderBy: { createdAt: "desc" },
          include: { sender: { select: userSelect } },
        })

        return {
          type: "group" as const,
          group: {
            id: group.id,
            name: group.name,
            description: group.description,
            adminId: group.adminId,
            coAdminId: group.coAdminId,
            admin: { ...group.admin, online: isOnline(group.admin.lastSeenAt) },
            coAdmin: group.coAdmin
              ? { ...group.coAdmin, online: isOnline(group.coAdmin.lastSeenAt) }
              : null,
            members: group.members.map((m) => ({
              id: m.id,
              groupId: m.groupId,
              userId: m.userId,
              user: { ...m.user, online: isOnline(m.user.lastSeenAt) },
              joinedAt: m.joinedAt.toISOString(),
            })),
            createdAt: group.createdAt.toISOString(),
            updatedAt: group.updatedAt.toISOString(),
          },
          lastMessage: last
            ? {
                id: last.id,
                content: last.content,
                senderId: last.senderId,
                sender: { ...last.sender, online: isOnline(last.sender.lastSeenAt) },
                recipientId: last.recipientId,
                groupId: last.groupId,
                createdAt: last.createdAt.toISOString(),
              }
            : null,
          unread: 0,
        }
      })
    )

    const all = [...dmConversations, ...groupConversations].sort((a, b) => {
      const ta = a.lastMessage?.createdAt ?? "0"
      const tb = b.lastMessage?.createdAt ?? "0"
      return tb.localeCompare(ta)
    })

    return ok(all)
  } catch (err) {
    return serverError(err)
  }
}
