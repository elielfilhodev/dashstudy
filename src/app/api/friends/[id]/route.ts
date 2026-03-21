import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/session"
import { ok, badRequest, forbidden, notFound, noContent, serverError } from "@/lib/api-response"
import { z } from "zod"

const patchSchema = z.object({
  action: z.enum(["accept", "reject", "block"]),
})

// PATCH /api/friends/[id] — accept, reject or block
export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const { userId, error } = await requireAuth()
  if (error) return error

  try {
    const friendship = await db.friendship.findUnique({ where: { id } })
    if (!friendship) return notFound("Solicitação")

    // Only the receiver can accept/reject
    if (friendship.receiverId !== userId && friendship.senderId !== userId) return forbidden()

    const body = await request.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) return badRequest("Ação inválida")

    if (parsed.data.action === "accept") {
      if (friendship.receiverId !== userId) return forbidden()
      const updated = await db.friendship.update({
        where: { id },
        data: { status: "ACCEPTED" },
      })
      return ok(updated)
    }

    if (parsed.data.action === "reject") {
      await db.friendship.delete({ where: { id } })
      return noContent()
    }

    if (parsed.data.action === "block") {
      const updated = await db.friendship.update({
        where: { id },
        data: { status: "BLOCKED" },
      })
      return ok(updated)
    }

    return badRequest("Ação inválida")
  } catch (err) {
    return serverError(err)
  }
}

// DELETE /api/friends/[id] — remove friend
export async function DELETE(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const { userId, error } = await requireAuth()
  if (error) return error

  try {
    const friendship = await db.friendship.findUnique({ where: { id } })
    if (!friendship) return notFound("Amizade")
    if (friendship.senderId !== userId && friendship.receiverId !== userId) return forbidden()

    await db.friendship.delete({ where: { id } })
    return noContent()
  } catch (err) {
    return serverError(err)
  }
}
