import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/session"
import { ok, created, badRequest, serverError } from "@/lib/api-response"
import { createBookSchema } from "@/lib/validations"
import { bookListSelect, isValidHttpCoverUrl, serializeBookListItem } from "@/lib/book-serialize"

export async function GET() {
  const { userId, error } = await requireAuth()
  if (error) return error

  try {
    const books = await db.book.findMany({
      where: { userId },
      select: bookListSelect,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    })
    return ok(books.map((b) => serializeBookListItem(b)))
  } catch (err) {
    return serverError(err)
  }
}

export async function POST(request: NextRequest) {
  const { userId, error } = await requireAuth()
  if (error) return error

  try {
    const body = await request.json()
    const parsed = createBookSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Dados inválidos")
    }
    const { coverUrl, ...rest } = parsed.data
    if (!isValidHttpCoverUrl(coverUrl ?? undefined)) {
      return badRequest("URL da capa deve começar com http:// ou https://")
    }

    const book = await db.book.create({
      data: {
        ...rest,
        userId,
        coverUrl: coverUrl?.trim() || null,
      },
      select: bookListSelect,
    })
    return created(serializeBookListItem(book))
  } catch (err) {
    return serverError(err)
  }
}
