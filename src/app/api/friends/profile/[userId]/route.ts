import { db } from "@/lib/db"
import { requireAuth } from "@/lib/session"
import { forbidden, notFound, ok, serverError } from "@/lib/api-response"

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000

function isOnline(lastSeenAt: Date | null): boolean {
  if (!lastSeenAt) return false
  return Date.now() - lastSeenAt.getTime() < ONLINE_THRESHOLD_MS
}

/**
 * GET /api/friends/profile/[userId]
 * Perfil público de um utilizador — apenas se houver amizade ACEITA.
 * Não expõe e-mail nem outros dados sensíveis.
 */
export async function GET(
  _request: Request,
  props: { params: Promise<{ userId: string }> }
) {
  const { userId: friendId } = await props.params
  const { userId: me, error } = await requireAuth()
  if (error) return error

  if (!friendId || friendId === me) {
    return forbidden()
  }

  try {
    const friendship = await db.friendship.findFirst({
      where: {
        status: "ACCEPTED",
        OR: [
          { senderId: me, receiverId: friendId },
          { senderId: friendId, receiverId: me },
        ],
      },
    })

    if (!friendship) {
      return forbidden()
    }

    const user = await db.user.findUnique({
      where: { id: friendId },
      select: {
        id: true,
        name: true,
        username: true,
        displayId: true,
        image: true,
        lastSeenAt: true,
        gamification: {
          select: {
            xp: true,
            totalCompletions: true,
            streakDays: true,
            bestStreak: true,
            achievements: {
              select: { key: true, unlockedAt: true },
              orderBy: { unlockedAt: "asc" },
            },
          },
        },
      },
    })

    if (!user) {
      return notFound("Utilizador")
    }

    const g = user.gamification

    return ok({
      user: {
        id: user.id,
        name: user.name ?? "Usuário",
        username: user.username,
        displayId: user.displayId,
        image: user.image,
        online: isOnline(user.lastSeenAt),
        lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
      },
      gamification: g
        ? {
            xp: g.xp,
            totalCompletions: g.totalCompletions,
            streakDays: g.streakDays,
            bestStreak: g.bestStreak,
            achievements: g.achievements.map((a) => ({
              key: a.key,
              unlockedAt: a.unlockedAt,
            })),
          }
        : {
            xp: 0,
            totalCompletions: 0,
            streakDays: 0,
            bestStreak: 0,
            achievements: [] as { key: string; unlockedAt: string }[],
          },
    })
  } catch (err) {
    return serverError(err)
  }
}
