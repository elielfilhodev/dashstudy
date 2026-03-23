import { db } from "@/lib/db"
import { requireAuth } from "@/lib/session"
import { ok, serverError } from "@/lib/api-response"

// GET /api/profile/activity — task completions per day (last 365 days)
export async function GET() {
  const { userId, error } = await requireAuth()
  if (error) return error

  try {
    const since = new Date()
    since.setFullYear(since.getFullYear() - 1)

    const doneTasks = await db.task.findMany({
      where: { userId, done: true, updatedAt: { gte: since } },
      select: { updatedAt: true },
    })

    const counts: Record<string, number> = {}
    for (const t of doneTasks) {
      const date = t.updatedAt.toISOString().split("T")[0]
      counts[date] = (counts[date] ?? 0) + 1
    }

    return ok(counts)
  } catch (err) {
    return serverError(err)
  }
}
