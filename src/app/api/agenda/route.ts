import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createAgendaItemSchema } from "@/lib/validations"
import { requireAuth } from "@/lib/session"
import { ok, created, badRequest, serverError } from "@/lib/api-response"

export async function GET() {
  const { userId, error } = await requireAuth()
  if (error) return error

  try {
    const items = await db.agendaItem.findMany({
      where: { userId },
      include: { subject: { select: { id: true, name: true } } },
      orderBy: [{ date: "asc" }, { time: "asc" }],
    })
    return ok(items)
  } catch (err) {
    return serverError(err)
  }
}

export async function POST(request: NextRequest) {
  const { userId, error } = await requireAuth()
  if (error) return error

  try {
    const body = await request.json()
    const parsed = createAgendaItemSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Dados inválidos")
    }

    const item = await db.agendaItem.create({
      data: { ...parsed.data, userId },
      include: { subject: { select: { id: true, name: true } } },
    })
    return created(item)
  } catch (err) {
    return serverError(err)
  }
}
