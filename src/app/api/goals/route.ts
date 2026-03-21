import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createGoalSchema } from "@/lib/validations"
import { requireAuth } from "@/lib/session"
import { ok, created, badRequest, serverError } from "@/lib/api-response"

export async function GET() {
  const { userId, error } = await requireAuth()
  if (error) return error

  try {
    const goals = await db.goal.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    })
    return ok(goals)
  } catch (err) {
    return serverError(err)
  }
}

export async function POST(request: NextRequest) {
  const { userId, error } = await requireAuth()
  if (error) return error

  try {
    const body = await request.json()
    const parsed = createGoalSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Dados inválidos")
    }

    const goal = await db.goal.create({
      data: { ...parsed.data, userId },
    })
    return created(goal)
  } catch (err) {
    return serverError(err)
  }
}
