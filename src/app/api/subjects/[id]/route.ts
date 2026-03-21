import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { updateSubjectProgressSchema } from "@/lib/validations"
import { requireAuth } from "@/lib/session"
import {
  ok,
  badRequest,
  forbidden,
  notFound,
  noContent,
  serverError,
} from "@/lib/api-response"

async function getOwnedSubject(id: string, userId: string) {
  const subject = await db.subject.findUnique({ where: { id } })
  if (!subject) return { subject: null, error: notFound("Matéria") }
  if (subject.userId !== userId) return { subject: null, error: forbidden() }
  return { subject, error: null }
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const { userId, error } = await requireAuth()
  if (error) return error

  try {
    const { subject, error: subjectError } = await getOwnedSubject(id, userId)
    if (subjectError) return subjectError

    const body = await request.json()
    const parsed = updateSubjectProgressSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Dados inválidos")
    }

    const updated = await db.subject.update({
      where: { id: subject!.id },
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
    const { error: subjectError } = await getOwnedSubject(id, userId)
    if (subjectError) return subjectError

    await db.subject.delete({ where: { id } })
    return noContent()
  } catch (err) {
    return serverError(err)
  }
}
