import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/session"
import { ok, created, badRequest, forbidden, serverError } from "@/lib/api-response"
import { sendMessageSchema } from "@/lib/validations"
import type { MessageAttachmentType } from "@/types"

const userSelect = {
  id: true,
  name: true,
  username: true,
  displayId: true,
  image: true,
  lastSeenAt: true,
} as const

// Tipo que cobre tanto mensagens já existentes quanto as novas com attachment
type SerializableMessage = {
  id: string
  content: string
  senderId: string
  recipientId: string | null
  groupId: string | null
  createdAt: Date
  sender: {
    id: string
    name: string | null
    username: string | null
    displayId: string
    image: string | null
    lastSeenAt: Date | null
  }
  [key: string]: unknown // permite campos extras como os de attachment após migration
}

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

function serializeMessage(m: SerializableMessage) {
  return {
    id: m.id,
    content: m.content,
    attachmentUrl: (m.attachmentUrl as string | null) ?? null,
    attachmentType: (m.attachmentType as MessageAttachmentType | null) ?? null,
    attachmentName: (m.attachmentName as string | null) ?? null,
    senderId: m.senderId,
    sender: { ...m.sender, online: false },
    recipientId: m.recipientId,
    groupId: m.groupId,
    createdAt: m.createdAt.toISOString(),
  }
}

// GET /api/chat/direct/[userId] — carrega mensagens DM com paginação por cursor
export async function GET(
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

    return ok((messages as SerializableMessage[]).map(serializeMessage))
  } catch (err) {
    return serverError(err)
  }
}

// POST /api/chat/direct/[userId] — envia mensagem DM (texto e/ou anexo)
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const msg = await (db.message.create as any)({
      data: {
        content: parsed.data.content,
        attachmentUrl: parsed.data.attachmentUrl ?? null,
        attachmentType: parsed.data.attachmentType ?? null,
        attachmentName: parsed.data.attachmentName ?? null,
        senderId: meId,
        recipientId: otherId,
      },
      include: { sender: { select: userSelect } },
    }) as SerializableMessage

    return created(serializeMessage(msg))
  } catch (err) {
    return serverError(err)
  }
}
