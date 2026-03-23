import { db } from "@/lib/db"
import { requireAuth } from "@/lib/session"
import { forbidden, notFound, noContent, serverError } from "@/lib/api-response"

export async function DELETE(
  _request: Request,
  props: { params: Promise<{ id: string; noteId: string }> }
) {
  const { id: bookId, noteId } = await props.params
  const { userId, error } = await requireAuth()
  if (error) return error

  try {
    const note = await db.bookNote.findFirst({
      where: { id: noteId, bookId },
      include: { book: { select: { userId: true } } },
    })
    if (!note) return notFound("Anotação")
    if (note.book.userId !== userId) return forbidden()

    await db.bookNote.delete({ where: { id: noteId } })
    return noContent()
  } catch (err) {
    return serverError(err)
  }
}
