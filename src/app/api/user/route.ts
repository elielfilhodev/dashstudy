import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/session"
import { updateUsernameSchema, updateAvatarSchema } from "@/lib/validations"
import { ok, badRequest, serverError } from "@/lib/api-response"

export async function PATCH(request: NextRequest) {
  const { userId, error } = await requireAuth()
  if (error) return error

  try {
    const body = await request.json()
    const { action } = body as { action?: string }

    if (action === "username") {
      const parsed = updateUsernameSchema.safeParse(body)
      if (!parsed.success) {
        return badRequest(parsed.error.issues[0]?.message ?? "Dados inválidos")
      }

      const { username } = parsed.data

      const existing = await db.user.findFirst({
        where: {
          username: { equals: username, mode: "insensitive" },
          NOT: { id: userId },
        },
      })
      if (existing) return badRequest("Este username já está em uso")

      const updated = await db.user.update({
        where: { id: userId },
        data: { username: username.toLowerCase() },
        select: { username: true },
      })
      return ok(updated)
    }

    if (action === "avatar") {
      const parsed = updateAvatarSchema.safeParse(body)
      if (!parsed.success) {
        return badRequest(parsed.error.issues[0]?.message ?? "URL inválida")
      }

      const updated = await db.user.update({
        where: { id: userId },
        data: { image: parsed.data.image },
        select: { image: true },
      })
      return ok(updated)
    }

    return badRequest("Ação inválida. Use action: 'username' ou 'avatar'")
  } catch (err) {
    return serverError(err)
  }
}
