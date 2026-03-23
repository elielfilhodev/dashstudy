import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/session"
import { ok, created, badRequest, serverError } from "@/lib/api-response"
import { createGroupSchema } from "@/lib/validations"

const userSelect = {
  id: true,
  name: true,
  username: true,
  displayId: true,
  image: true,
  lastSeenAt: true,
} as const

// GET /api/chat/groups — list groups the user is a member of
export async function GET() {
  const { userId, error } = await requireAuth()
  if (error) return error

  try {
    const memberships = await db.chatGroupMember.findMany({
      where: { userId },
      include: {
        group: {
          include: {
            admin: { select: userSelect },
            coAdmin: { select: userSelect },
            members: { include: { user: { select: userSelect } } },
          },
        },
      },
    })

    const groups = memberships.map(({ group }) => ({
      id: group.id,
      name: group.name,
      description: group.description,
      adminId: group.adminId,
      coAdminId: group.coAdminId,
      admin: group.admin,
      coAdmin: group.coAdmin,
      members: group.members.map((m) => ({
        id: m.id,
        groupId: m.groupId,
        userId: m.userId,
        user: m.user,
        joinedAt: m.joinedAt.toISOString(),
      })),
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
    }))

    return ok(groups)
  } catch (err) {
    return serverError(err)
  }
}

// POST /api/chat/groups — create a new group
export async function POST(request: NextRequest) {
  const { userId, error } = await requireAuth()
  if (error) return error

  try {
    const body = await request.json()
    const parsed = createGroupSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Dados inválidos")

    const group = await db.chatGroup.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        adminId: userId,
        members: {
          create: { userId },
        },
      },
      include: {
        admin: { select: userSelect },
        coAdmin: { select: userSelect },
        members: { include: { user: { select: userSelect } } },
      },
    })

    return created({
      id: group.id,
      name: group.name,
      description: group.description,
      adminId: group.adminId,
      coAdminId: group.coAdminId,
      admin: group.admin,
      coAdmin: group.coAdmin,
      members: group.members.map((m) => ({
        id: m.id,
        groupId: m.groupId,
        userId: m.userId,
        user: m.user,
        joinedAt: m.joinedAt.toISOString(),
      })),
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
    })
  } catch (err) {
    return serverError(err)
  }
}
