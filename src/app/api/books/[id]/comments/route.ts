import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/session"
import { created, badRequest, notFound, serverError } from "@/lib/api-response"
import { createBookCommentSchema } from "@/lib/validations"
import { getBookAccess } from "@/lib/books-access"

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id: bookId } = await props.params
  const { userId, error } = await requireAuth()
  if (error) return error

  const access = await getBookAccess(bookId, userId)
  if (!access) return notFound("Livro")
  if (access.access === "owner") {
    return badRequest("Amigos comentam aqui; use anotações para lembretes pessoais")
  }

  try {
    const body = await request.json()
    const parsed = createBookCommentSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Comentário inválido")
    }

    const comment = await db.bookComment.create({
      data: {
        bookId,
        userId,
        body: parsed.data.body.trim(),
      },
      select: {
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
      },
    })

    return created({
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      user: {
        id: comment.user.id,
        name: comment.user.name ?? "Usuário",
        username: comment.user.username,
        displayId: comment.user.displayId,
        image: comment.user.image,
      },
    })
  } catch (err) {
    return serverError(err)
  }
}
