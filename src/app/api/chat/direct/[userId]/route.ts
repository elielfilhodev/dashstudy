import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/session"
import { ok, created, badRequest, forbidden, serverError } from "@/lib/api-response"
import { sendMessageSchema } from "@/lib/validations"

const userSelect = {
  id: true,
  name: true,
  username: true,
  displayId: true,
  image: true,
  lastSeenAt: true,
} as const

async function assertFriendship(userId: string, otherId: string) {
  const f = await db.friendship.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { senderId: userId, receiverId: otherId },
        { senderId: otherId, receiverId: userId },
      ],
    },
  })
  return !!f
}

// GET /api/chat/direct/[userId] — load DM messages
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ userId: string }> }
) {
  const { userId: meId, error } = await requireAuth()
  if (error) return error

  const { userId: otherId } = await props.params
  if (meId === otherId) return badRequest("Não é possível conversar consigo mesmo")

  try {
    const ok2 = await assertFriendship(meId, otherId)
    if (!ok2) return forbidden()

    const cursor = new URL(request.url).searchParams.get("cursor")

    const messages = await db.message.findMany({
      where: {
        OR: [
          { senderId: meId, recipientId: otherId },
          { senderId: otherId, recipientId: meId },
        ],
      },
      include: { sender: { select: userSelect } },
      orderBy: { createdAt: "asc" },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: 50,
    })

    return ok(
      messages.map((m) => ({
        id: m.id,
        content: m.content,
        senderId: m.senderId,
        sender: { ...m.sender, online: false },
        recipientId: m.recipientId,
        groupId: m.groupId,
        createdAt: m.createdAt.toISOString(),
      }))
    )
  } catch (err) {
    return serverError(err)
  }
}

// POST /api/chat/direct/[userId] — send DM
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ userId: string }> }
) {
  const { userId: meId, error } = await requireAuth()
  if (error) return error

  const { userId: otherId } = await props.params
  if (meId === otherId) return badRequest("Não é possível conversar consigo mesmo")

  try {
    const isFriend = await assertFriendship(meId, otherId)
    if (!isFriend) return forbidden()

    const body = await request.json()
    const parsed = sendMessageSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Dados inválidos")

    const msg = await db.message.create({
      data: {
        content: parsed.data.content,
        senderId: meId,
        recipientId: otherId,
      },
      include: { sender: { select: userSelect } },
    })

    return created({
      id: msg.id,
      content: msg.content,
      senderId: msg.senderId,
      sender: { ...msg.sender, online: false },
      recipientId: msg.recipientId,
      groupId: msg.groupId,
      createdAt: msg.createdAt.toISOString(),
    })
  } catch (err) {
    return serverError(err)
  }
}
