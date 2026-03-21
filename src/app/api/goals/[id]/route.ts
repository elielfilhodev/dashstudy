import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { updateGoalSchema } from "@/lib/validations"
import { requireAuth } from "@/lib/session"
import {
  ok,
  badRequest,
  forbidden,
  notFound,
  noContent,
  serverError,
} from "@/lib/api-response"

async function getOwnedGoal(id: string, userId: string) {
  const goal = await db.goal.findUnique({ where: { id } })
  if (!goal) return { goal: null, error: notFound("Meta") }
  if (goal.userId !== userId) return { goal: null, error: forbidden() }
  return { goal, error: null }
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const { userId, error } = await requireAuth()
  if (error) return error

  try {
    const { goal, error: goalError } = await getOwnedGoal(id, userId)
    if (goalError) return goalError

    const body = await request.json()
    const parsed = updateGoalSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Dados inválidos")
    }

    const updated = await db.goal.update({
      where: { id: goal!.id },
      data: parsed.data,
    })
    return ok(updated)
  } catch (err) {
    return serverError(err)
  }
}

export async function DELETE(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const { userId, error } = await requireAuth()
  if (error) return error

  try {
    const { error: goalError } = await getOwnedGoal(id, userId)
    if (goalError) return goalError

    await db.goal.delete({ where: { id } })
    return noContent()
  } catch (err) {
    return serverError(err)
  }
}
