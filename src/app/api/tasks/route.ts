import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createTaskSchema } from "@/lib/validations"
import { requireAuth } from "@/lib/session"
import { ok, created, badRequest, serverError } from "@/lib/api-response"

export async function GET() {
  const { userId, error } = await requireAuth()
  if (error) return error

  try {
    const tasks = await db.task.findMany({
      where: { userId },
      include: { subject: { select: { id: true, name: true } } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    })
    return ok(tasks)
  } catch (err) {
    return serverError(err)
  }
}

export async function POST(request: NextRequest) {
  const { userId, error } = await requireAuth()
  if (error) return error

  try {
    const body = await request.json()
    const parsed = createTaskSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Dados inválidos")
    }

    const task = await db.task.create({
      data: { ...parsed.data, userId },
      include: { subject: { select: { id: true, name: true } } },
    })
    return created(task)
  } catch (err) {
    return serverError(err)
  }
}
