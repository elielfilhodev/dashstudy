import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/session"
import { ok, badRequest, serverError } from "@/lib/api-response"
import { z } from "zod"

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutes

function isOnline(lastSeenAt: Date | null): boolean {
  if (!lastSeenAt) return false
  return Date.now() - lastSeenAt.getTime() < ONLINE_THRESHOLD_MS
}

function serializeFriend(user: {
  id: string
  name: string | null
  username: string | null
  displayId: string
  image: string | null
  lastSeenAt: Date | null
  gamification: { xp: number } | null
}) {
  return {
    id: user.id,
    name: user.name ?? "Usuário",
    username: user.username,
    displayId: user.displayId,
    image: user.image,
    online: isOnline(user.lastSeenAt),
    lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
    xp: user.gamification?.xp ?? 0,
  }
}

const friendUserSelect = {
  id: true,
  name: true,
  username: true,
  displayId: true,
  image: true,
  lastSeenAt: true,
  gamification: { select: { xp: true } },
} as const

// GET /api/friends — list accepted friends + pending requests
export async function GET() {
  const { userId, error } = await requireAuth()
  if (error) return error

  try {
    const [sent, received] = await Promise.all([
      db.friendship.findMany({
        where: { senderId: userId },
        include: { receiver: { select: friendUserSelect } },
      }),
      db.friendship.findMany({
        where: { receiverId: userId },
        include: { sender: { select: friendUserSelect } },
      }),
    ])

    const friends = [
      ...sent
        .filter((f) => f.status === "ACCEPTED")
        .map((f) => ({ ...serializeFriend(f.receiver), friendshipId: f.id, direction: "sent" as const })),
      ...received
        .filter((f) => f.status === "ACCEPTED")
        .map((f) => ({ ...serializeFriend(f.sender), friendshipId: f.id, direction: "received" as const })),
    ].sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0))

    const pendingReceived = received
      .filter((f) => f.status === "PENDING")
      .map((f) => ({ ...serializeFriend(f.sender), friendshipId: f.id, direction: "received" as const }))

    const pendingSent = sent
      .filter((f) => f.status === "PENDING")
      .map((f) => ({ ...serializeFriend(f.receiver), friendshipId: f.id, direction: "sent" as const }))

    return ok({ friends, pendingReceived, pendingSent })
  } catch (err) {
    return serverError(err)
  }
}

const sendSchema = z.object({
  username: z.string().min(1),
})

// POST /api/friends — send friend request by username
export async function POST(request: NextRequest) {
  const { userId, error } = await requireAuth()
  if (error) return error

  try {
    const body = await request.json()
    const parsed = sendSchema.safeParse(body)
    if (!parsed.success) return badRequest("Username inválido")

    const targetUser = await db.user.findFirst({
      where: {
        username: { equals: parsed.data.username, mode: "insensitive" },
        NOT: { id: userId },
      },
      select: { id: true, name: true, username: true, displayId: true, image: true },
    })

    if (!targetUser) return badRequest("Usuário não encontrado")

    // Check if friendship already exists (either direction)
    const existing = await db.friendship.findFirst({
      where: {
        OR: [
          { senderId: userId, receiverId: targetUser.id },
          { senderId: targetUser.id, receiverId: userId },
        ],
      },
    })

    if (existing) {
      if (existing.status === "ACCEPTED") return badRequest("Vocês já são amigos")
      if (existing.status === "PENDING") return badRequest("Solicitação já enviada")
      return badRequest("Não foi possível enviar solicitação")
    }

    const friendship = await db.friendship.create({
      data: { senderId: userId, receiverId: targetUser.id },
    })

    return ok({ friendship, target: targetUser })
  } catch (err) {
    return serverError(err)
  }
}
