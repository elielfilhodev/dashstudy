import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSubjectSchema } from "@/lib/validations"
import { requireAuth } from "@/lib/session"
import {
  ok,
  created,
  badRequest,
  serverError,
} from "@/lib/api-response"

export async function GET() {
  const { userId, error } = await requireAuth()
  if (error) return error

  try {
    const subjects = await db.subject.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    })
    return ok(subjects)
  } catch (err) {
    return serverError(err)
  }
}

export async function POST(request: NextRequest) {
  const { userId, error } = await requireAuth()
  if (error) return error

  try {
    const body = await request.json()
    const parsed = createSubjectSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Dados inválidos")
    }

    const subject = await db.subject.create({
      data: { ...parsed.data, userId },
    })
    return created(subject)
  } catch (err) {
    return serverError(err)
  }
}
