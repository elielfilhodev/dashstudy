import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/session"
import { ok, created, badRequest, forbidden, notFound, serverError } from "@/lib/api-response"
import { z } from "zod"

const userSelect = {
  id: true,
  name: true,
  username: true,
  displayId: true,
  image: true,
  lastSeenAt: true,
} as const

const addMemberSchema = z.object({ userId: z.string().cuid() })

// GET /api/chat/groups/[groupId]/members
export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ groupId: string }> }
) {
  const { userId, error } = await requireAuth()
  if (error) return error

  const { groupId } = await props.params

  try {
    const group = await db.chatGroup.findUnique({ where: { id: groupId }, select: { id: true } })
    if (!group) return notFound("Grupo")

    const me = await db.chatGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    })
    if (!me) return forbidden()

    const members = await db.chatGroupMember.findMany({
      where: { groupId },
      include: { user: { select: userSelect } },
    })

    return ok(
      members.map((m) => ({
        id: m.id,
        groupId: m.groupId,
        userId: m.userId,
        user: m.user,
        joinedAt: m.joinedAt.toISOString(),
      }))
    )
  } catch (err) {
    return serverError(err)
  }
}

// POST /api/chat/groups/[groupId]/members — add member (admin or co-admin only)
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ groupId: string }> }
) {
  const { userId, error } = await requireAuth()
  if (error) return error

  const { groupId } = await props.params

  try {
    const group = await db.chatGroup.findUnique({ where: { id: groupId } })
    if (!group) return notFound("Grupo")

    const isAdminOrCoAdmin = group.adminId === userId || group.coAdminId === userId
    if (!isAdminOrCoAdmin) return forbidden()

    const body = await request.json()
    const parsed = addMemberSchema.safeParse(body)
    if (!parsed.success) return badRequest("userId inválido")

    const targetId = parsed.data.userId

    // Must be a friend of the current user
    const friendship = await db.friendship.findFirst({
      where: {
        status: "ACCEPTED",
        OR: [
          { senderId: userId, receiverId: targetId },
          { senderId: targetId, receiverId: userId },
        ],
      },
    })
    if (!friendship) return badRequest("Só é possível adicionar amigos ao grupo")

    // Already a member?
    const existing = await db.chatGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId: targetId } },
    })
    if (existing) return badRequest("Usuário já é membro do grupo")

    const member = await db.chatGroupMember.create({
      data: { groupId, userId: targetId },
      include: { user: { select: userSelect } },
    })

    return created({
      id: member.id,
      groupId: member.groupId,
      userId: member.userId,
      user: member.user,
      joinedAt: member.joinedAt.toISOString(),
    })
  } catch (err) {
    return serverError(err)
  }
}
