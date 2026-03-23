import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/session"
import { getBookAccess } from "@/lib/books-access"
import { badRequest, forbidden, notFound, noContent, serverError } from "@/lib/api-response"

const MAX_BYTES = 1_500_000
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"])

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params
  const { userId, error } = await requireAuth()
  if (error) return error

  try {
    const book = await db.book.findUnique({
      where: { id },
      select: {
        userId: true,
        coverMime: true,
        coverBlob: true,
      },
    })
    if (!book?.coverBlob || !book.coverMime) {
      return notFound("Capa")
    }

    const access = await getBookAccess(id, userId)
    if (!access) return notFound("Capa")

    const body = new Uint8Array(book.coverBlob)
    return new NextResponse(body, {
      headers: {
        "Content-Type": book.coverMime,
        "Cache-Control": "private, max-age=86400",
      },
    })
  } catch (err) {
    return serverError(err)
  }
}

export async function POST(
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
    const form = await request.formData()
    const file = form.get("file")
    if (!file || typeof file === "string") {
      return badRequest("Envie um arquivo de imagem no campo file")
    }
    const blob = file as File
    if (!ALLOWED.has(blob.type)) {
      return badRequest("Use JPEG, PNG ou WebP")
    }
    const buf = Buffer.from(await blob.arrayBuffer())
    if (buf.length > MAX_BYTES) {
      return badRequest("Imagem muito grande (máx. ~1,5 MB)")
    }

    await db.book.update({
      where: { id },
      data: {
        coverBlob: buf,
        coverMime: blob.type,
        coverUrl: null,
      },
    })

    return NextResponse.json({ data: { ok: true } })
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
    await db.book.update({
      where: { id },
      data: { coverBlob: null, coverMime: null },
    })
    return noContent()
  } catch (err) {
    return serverError(err)
  }
}
