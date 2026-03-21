import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { updateAgendaItemSchema } from "@/lib/validations"
import { requireAuth } from "@/lib/session"
import {
  ok,
  badRequest,
  forbidden,
  notFound,
  noContent,
  serverError,
} from "@/lib/api-response"

async function getOwnedItem(id: string, userId: string) {
  const item = await db.agendaItem.findUnique({ where: { id } })
  if (!item) return { item: null, error: notFound("Item de agenda") }
  if (item.userId !== userId) return { item: null, error: forbidden() }
  return { item, error: null }
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const { userId, error } = await requireAuth()
  if (error) return error

  try {
    const { item, error: itemError } = await getOwnedItem(id, userId)
    if (itemError) return itemError

    const body = await request.json()
    const parsed = updateAgendaItemSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Dados inválidos")
    }

    const updated = await db.agendaItem.update({
      where: { id: item!.id },
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
    const { error: itemError } = await getOwnedItem(id, userId)
    if (itemError) return itemError

    await db.agendaItem.delete({ where: { id } })
    return noContent()
  } catch (err) {
    return serverError(err)
  }
}
