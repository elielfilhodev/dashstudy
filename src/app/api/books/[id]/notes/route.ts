import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/session"
import { created, badRequest, forbidden, notFound, serverError } from "@/lib/api-response"
import { createBookNoteSchema } from "@/lib/validations"

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id: bookId } = await props.params
  const { userId, error } = await requireAuth()
  if (error) return error

  const book = await db.book.findUnique({
    where: { id: bookId },
    select: { userId: true },
  })
  if (!book) return notFound("Livro")
  if (book.userId !== userId) return forbidden()

  try {
    const body = await request.json()
    const parsed = createBookNoteSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Texto inválido")
    }

    const note = await db.bookNote.create({
      data: {
        bookId,
        userId,
        body: parsed.data.body.trim(),
      },
      select: { id: true, body: true, createdAt: true },
    })

    return created({
      id: note.id,
      body: note.body,
      createdAt: note.createdAt.toISOString(),
    })
  } catch (err) {
    return serverError(err)
  }
}
