import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/session"
import { ok, badRequest, forbidden, notFound, noContent, serverError } from "@/lib/api-response"
import { updateBookSchema } from "@/lib/validations"
import { getBookAccess } from "@/lib/books-access"
import { isValidHttpCoverUrl, serializeBookListItem } from "@/lib/book-serialize"

const commentSelect = {
  id: true,
  body: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      name: true,
      username: true,
      displayId: true,
      image: true,
    },
  },
} as const

function serializeComment(c: {
  id: string
  body: string
  createdAt: Date
  user: {
    id: string
    name: string | null
    username: string | null
    displayId: string
    image: string | null
  }
}) {
  return {
    id: c.id,
    body: c.body,
    createdAt: c.createdAt.toISOString(),
    user: {
      id: c.user.id,
      name: c.user.name ?? "Usuário",
      username: c.user.username,
      displayId: c.user.displayId,
      image: c.user.image,
    },
  }
}

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params
  const { userId, error } = await requireAuth()
  if (error) return error

  const access = await getBookAccess(id, userId)
  if (!access) return notFound("Livro")

  try {
    if (access.access === "owner") {
      const book = await db.book.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          author: true,
          isbn: true,
          rating: true,
          review: true,
          coverUrl: true,
          coverMime: true,
          createdAt: true,
          updatedAt: true,
          notes: {
            orderBy: { createdAt: "desc" },
            select: { id: true, body: true, createdAt: true },
          },
          comments: {
            orderBy: { createdAt: "asc" },
            select: commentSelect,
          },
          _count: { select: { notes: true, comments: true } },
        },
      })
      if (!book) return notFound("Livro")
      return ok({
        role: "owner" as const,
        book: {
          ...serializeBookListItem({
            id: book.id,
            title: book.title,
            author: book.author,
            isbn: book.isbn,
            rating: book.rating,
            coverUrl: book.coverUrl,
            coverMime: book.coverMime,
            createdAt: book.createdAt,
            updatedAt: book.updatedAt,
            _count: book._count,
          }),
          review: book.review,
          notes: book.notes.map((n) => ({
            id: n.id,
            body: n.body,
            createdAt: n.createdAt.toISOString(),
          })),
          comments: book.comments.map(serializeComment),
        },
      })
    }

    const book = await db.book.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        author: true,
        isbn: true,
        rating: true,
        review: true,
        coverUrl: true,
        coverMime: true,
        createdAt: true,
        updatedAt: true,
        comments: {
          orderBy: { createdAt: "asc" },
          select: commentSelect,
        },
        _count: { select: { comments: true } },
      },
    })
    if (!book) return notFound("Livro")
    return ok({
      role: "friend" as const,
      book: {
        ...serializeBookListItem(
          {
            id: book.id,
            title: book.title,
            author: book.author,
            isbn: book.isbn,
            rating: book.rating,
            coverUrl: book.coverUrl,
            coverMime: book.coverMime,
            createdAt: book.createdAt,
            updatedAt: book.updatedAt,
            _count: { notes: 0, comments: book._count.comments },
          },
          { hideNotesCount: true }
        ),
        review: book.review,
        comments: book.comments.map(serializeComment),
      },
    })
  } catch (err) {
    return serverError(err)
  }
}

export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params
  const { userId, error } = await requireAuth()
  if (error) return error

  const book = await db.book.findUnique({ where: { id }, select: { userId: true } })
  if (!book) return notFound("Livro")
  if (book.userId !== userId) return forbidden()

  try {
    const body = await request.json()
    const parsed = updateBookSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Dados inválidos")
    }
    const data = parsed.data
    const touched = Object.keys(data).filter((k) => data[k as keyof typeof data] !== undefined)
    if (touched.length === 0) {
      return badRequest("Nada para atualizar")
    }
    if (data.coverUrl !== undefined && !isValidHttpCoverUrl(data.coverUrl ?? undefined)) {
      return badRequest("URL da capa deve começar com http:// ou https://")
    }

    const clearUploadedCover =
      data.coverUrl !== undefined && Boolean(data.coverUrl?.trim())

    const updated = await db.book.update({
      where: { id },
      data: {
        ...("title" in data && data.title !== undefined ? { title: data.title } : {}),
        ...("author" in data && data.author !== undefined ? { author: data.author } : {}),
        ...("isbn" in data && data.isbn !== undefined ? { isbn: data.isbn } : {}),
        ...("rating" in data && data.rating !== undefined ? { rating: data.rating } : {}),
        ...("review" in data && data.review !== undefined ? { review: data.review } : {}),
        ...(data.coverUrl !== undefined
          ? {
              coverUrl: data.coverUrl?.trim() || null,
              ...(clearUploadedCover ? { coverBlob: null, coverMime: null } : {}),
            }
          : {}),
      },
      select: {
        id: true,
        title: true,
        author: true,
        isbn: true,
        rating: true,
        coverUrl: true,
        coverMime: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { notes: true, comments: true } },
      },
    })

    return ok(serializeBookListItem(updated))
  } catch (err) {
    return serverError(err)
  }
}

export async function DELETE(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params
  const { userId, error } = await requireAuth()
  if (error) return error

  const book = await db.book.findUnique({ where: { id }, select: { userId: true } })
  if (!book) return notFound("Livro")
  if (book.userId !== userId) return forbidden()

  try {
    await db.book.delete({ where: { id } })
    return noContent()
  } catch (err) {
    return serverError(err)
  }
}
