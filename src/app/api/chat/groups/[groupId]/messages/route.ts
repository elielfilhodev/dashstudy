import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/session"
import { ok, created, badRequest, forbidden, notFound, serverError } from "@/lib/api-response"
import { sendMessageSchema } from "@/lib/validations"

const userSelect = {
  id: true,
  name: true,
  username: true,
  displayId: true,
  image: true,
  lastSeenAt: true,
} as const

// GET /api/chat/groups/[groupId]/messages
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ groupId: string }> }
) {
  const { userId, error } = await requireAuth()
  if (error) return error

  const { groupId } = await props.params

  try {
    const group = await db.chatGroup.findUnique({ where: { id: groupId }, select: { id: true } })
    if (!group) return notFound("Grupo")

    const member = await db.chatGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    })
    if (!member) return forbidden()

    const cursor = new URL(request.url).searchParams.get("cursor")

    const messages = await db.message.findMany({
      where: { groupId },
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

// POST /api/chat/groups/[groupId]/messages
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ groupId: string }> }
) {
  const { userId, error } = await requireAuth()
  if (error) return error

  const { groupId } = await props.params

  try {
    const group = await db.chatGroup.findUnique({ where: { id: groupId }, select: { id: true } })
    if (!group) return notFound("Grupo")

    const member = await db.chatGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    })
    if (!member) return forbidden()

    const body = await request.json()
    const parsed = sendMessageSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Dados inválidos")

    const msg = await db.message.create({
      data: { content: parsed.data.content, senderId: userId, groupId },
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
