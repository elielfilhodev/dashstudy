import { db } from "@/lib/db"
import { requireAuth } from "@/lib/session"
import { ok, serverError } from "@/lib/api-response"

// Called by the client every 2 minutes to mark the user as online
export async function POST() {
  const { userId, error } = await requireAuth()
  if (error) return error

  try {
    await db.user.update({
      where: { id: userId },
      data: { lastSeenAt: new Date() },
    })
    return ok({ ok: true })
  } catch (err) {
    return serverError(err)
  }
}
