import { db } from "@/lib/db"
import { requireAuth } from "@/lib/session"
import { forbidden, notFound, ok, serverError } from "@/lib/api-response"
import { serializeBookListItem } from "@/lib/book-serialize"

const listSelect = {
  id: true,
  title: true,
  author: true,
  isbn: true,
  rating: true,
  coverUrl: true,
  coverMime: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { comments: true } },
} as const

/**
 * GET /api/friends/profile/[userId]/books
 * Livros de um amigo (amizade ACEITA). Não expõe contagem de anotações privadas.
 */
export async function GET(
  _request: Request,
  props: { params: Promise<{ userId: string }> }
) {
  const { userId: friendId } = await props.params
  const { userId: me, error } = await requireAuth()
  if (error) return error

  if (!friendId || friendId === me) {
    return forbidden()
  }

  try {
    const friendship = await db.friendship.findFirst({
      where: {
        status: "ACCEPTED",
        OR: [
          { senderId: me, receiverId: friendId },
          { senderId: friendId, receiverId: me },
        ],
      },
    })

    if (!friendship) {
      return forbidden()
    }

    const friend = await db.user.findUnique({
      where: { id: friendId },
      select: { id: true },
    })
    if (!friend) return notFound("Utilizador")

    const books = await db.book.findMany({
      where: { userId: friendId },
      select: listSelect,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    })

    return ok(
      books.map((b) =>
        serializeBookListItem(
          {
            ...b,
            _count: { notes: 0, comments: b._count.comments },
          },
          { hideNotesCount: true }
        )
      )
    )
  } catch (err) {
    return serverError(err)
  }
}
