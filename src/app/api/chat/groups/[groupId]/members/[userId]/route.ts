import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/session"
import { ok, badRequest, forbidden, notFound, noContent, serverError } from "@/lib/api-response"

// DELETE /api/chat/groups/[groupId]/members/[userId] — remove member
export async function DELETE(
  _request: NextRequest,
  props: { params: Promise<{ groupId: string; userId: string }> }
) {
  const { userId: meId, error } = await requireAuth()
  if (error) return error

  const { groupId, userId: targetId } = await props.params

  try {
    const group = await db.chatGroup.findUnique({ where: { id: groupId } })
    if (!group) return notFound("Grupo")

    // Allow: admin, co-admin, or self-leave
    const canRemove =
      group.adminId === meId ||
      group.coAdminId === meId ||
      meId === targetId

    if (!canRemove) return forbidden()

    // Admin cannot be removed (must delete group instead)
    if (targetId === group.adminId) return badRequest("O admin não pode ser removido do grupo")

    const member = await db.chatGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId: targetId } },
    })
    if (!member) return notFound("Membro")

    await db.chatGroupMember.delete({ where: { id: member.id } })

    // If co-admin leaves or is removed, clear coAdminId
    if (group.coAdminId === targetId) {
      await db.chatGroup.update({ where: { id: groupId }, data: { coAdminId: null } })
    }

    return noContent()
  } catch (err) {
    return serverError(err)
  }
}

// PATCH /api/chat/groups/[groupId]/members/[userId] — promote to co-admin (admin only)
export async function PATCH(
  _request: NextRequest,
  props: { params: Promise<{ groupId: string; userId: string }> }
) {
  const { userId: meId, error } = await requireAuth()
  if (error) return error

  const { groupId, userId: targetId } = await props.params

  try {
    const group = await db.chatGroup.findUnique({ where: { id: groupId } })
    if (!group) return notFound("Grupo")

    if (group.adminId !== meId) return forbidden()
    if (targetId === meId) return badRequest("Admin não pode ser co-admin")

    const member = await db.chatGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId: targetId } },
    })
    if (!member) return notFound("Membro")

    // Toggle: if already co-admin, demote; else promote
    const newCoAdminId = group.coAdminId === targetId ? null : targetId

    const updated = await db.chatGroup.update({
      where: { id: groupId },
      data: { coAdminId: newCoAdminId },
      select: { coAdminId: true },
    })

    return ok({ coAdminId: updated.coAdminId })
  } catch (err) {
    return serverError(err)
  }
}
