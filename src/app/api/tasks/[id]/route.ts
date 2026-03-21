import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { updateTaskSchema } from "@/lib/validations"
import { requireAuth } from "@/lib/session"
import {
  ok,
  badRequest,
  forbidden,
  notFound,
  noContent,
  serverError,
} from "@/lib/api-response"

async function getOwnedTask(id: string, userId: string) {
  const task = await db.task.findUnique({ where: { id } })
  if (!task) return { task: null, error: notFound("Tarefa") }
  if (task.userId !== userId) return { task: null, error: forbidden() }
  return { task, error: null }
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const { userId, error } = await requireAuth()
  if (error) return error

  try {
    const { task, error: taskError } = await getOwnedTask(id, userId)
    if (taskError) return taskError

    const body = await request.json()
    const parsed = updateTaskSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Dados inválidos")
    }

    const updated = await db.task.update({
      where: { id: task!.id },
      data: parsed.data,
      include: { subject: { select: { id: true, name: true } } },
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
    const { error: taskError } = await getOwnedTask(id, userId)
    if (taskError) return taskError

    await db.task.delete({ where: { id } })
    return noContent()
  } catch (err) {
    return serverError(err)
  }
}
