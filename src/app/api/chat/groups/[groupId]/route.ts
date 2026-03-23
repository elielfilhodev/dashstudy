import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/session"
import { ok, badRequest, forbidden, notFound, noContent, serverError } from "@/lib/api-response"
import { updateGroupSchema } from "@/lib/validations"

const userSelect = {
  id: true,
  name: true,
  username: true,
  displayId: true,
  image: true,
  lastSeenAt: true,
} as const

async function getGroupAsMember(groupId: string, userId: string) {
  const group = await db.chatGroup.findUnique({
    where: { id: groupId },
    include: {
      admin: { select: userSelect },
      coAdmin: { select: userSelect },
      members: { include: { user: { select: userSelect } } },
    },
  })
  if (!group) return { group: null, error: notFound("Grupo") }

  const isMember = group.members.some((m) => m.userId === userId)
  if (!isMember) return { group: null, error: forbidden() }

  return { group, error: null }
}

// GET /api/chat/groups/[groupId]
export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ groupId: string }> }
) {
  const { userId, error } = await requireAuth()
  if (error) return error

  const { groupId } = await props.params

  try {
    const { group, error: ge } = await getGroupAsMember(groupId, userId)
    if (ge) return ge

    return ok({
      id: group!.id,
      name: group!.name,
      description: group!.description,
      adminId: group!.adminId,
      coAdminId: group!.coAdminId,
      admin: group!.admin,
      coAdmin: group!.coAdmin,
      members: group!.members.map((m) => ({
        id: m.id,
        groupId: m.groupId,
        userId: m.userId,
        user: m.user,
        joinedAt: m.joinedAt.toISOString(),
      })),
      createdAt: group!.createdAt.toISOString(),
      updatedAt: group!.updatedAt.toISOString(),
    })
  } catch (err) {
    return serverError(err)
  }
}

// PATCH /api/chat/groups/[groupId] — admin-only update (name, description, coAdmin)
export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ groupId: string }> }
) {
  const { userId, error } = await requireAuth()
  if (error) return error

  const { groupId } = await props.params

  try {
    const { group, error: ge } = await getGroupAsMember(groupId, userId)
    if (ge) return ge

    if (group!.adminId !== userId) return forbidden()

    const body = await request.json()
    const parsed = updateGroupSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Dados inválidos")

    // Validate coAdminId is a member of the group
    if (parsed.data.coAdminId !== undefined && parsed.data.coAdminId !== null) {
      const isMember = group!.members.some((m) => m.userId === parsed.data.coAdminId)
      if (!isMember) return badRequest("Co-admin deve ser membro do grupo")
      if (parsed.data.coAdminId === userId) return badRequest("Admin não pode ser co-admin")
    }

    const updated = await db.chatGroup.update({
      where: { id: groupId },
      data: parsed.data,
      include: {
        admin: { select: userSelect },
        coAdmin: { select: userSelect },
        members: { include: { user: { select: userSelect } } },
      },
    })

    return ok({
      id: updated.id,
      name: updated.name,
      description: updated.description,
      adminId: updated.adminId,
      coAdminId: updated.coAdminId,
      admin: updated.admin,
      coAdmin: updated.coAdmin,
      members: updated.members.map((m) => ({
        id: m.id,
        groupId: m.groupId,
        userId: m.userId,
        user: m.user,
        joinedAt: m.joinedAt.toISOString(),
      })),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    })
  } catch (err) {
    return serverError(err)
  }
}

// DELETE /api/chat/groups/[groupId] — admin-only delete
export async function DELETE(
  _request: NextRequest,
  props: { params: Promise<{ groupId: string }> }
) {
  const { userId, error } = await requireAuth()
  if (error) return error

  const { groupId } = await props.params

  try {
    const { group, error: ge } = await getGroupAsMember(groupId, userId)
    if (ge) return ge

    if (group!.adminId !== userId) return forbidden()

    await db.chatGroup.delete({ where: { id: groupId } })
    return noContent()
  } catch (err) {
    return serverError(err)
  }
}
