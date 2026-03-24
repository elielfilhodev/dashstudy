import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/session"
import { ok, badRequest, serverError } from "@/lib/api-response"

const MAX_BYTES = 4 * 1024 * 1024 // 4 MB
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"]

export async function GET() {
  const { userId, error } = await requireAuth()
  if (error) return error

  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { bannerBlob: true, bannerMime: true, bannerUrl: true },
    })

    if (user?.bannerBlob && user.bannerMime) {
      return new NextResponse(new Uint8Array(user.bannerBlob), {
        headers: {
          "Content-Type": user.bannerMime,
          "Cache-Control": "private, max-age=86400",
        },
      })
    }

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return serverError(err)
  }
}

export async function POST(request: NextRequest) {
  const { userId, error } = await requireAuth()
  if (error) return error

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) return badRequest("Arquivo não encontrado")
    if (!ALLOWED_MIME.includes(file.type)) return badRequest("Formato inválido. Use JPG, PNG, WebP ou GIF")
    if (file.size > MAX_BYTES) return badRequest("Arquivo muito grande (máx 4 MB)")

    const buffer = Buffer.from(await file.arrayBuffer())

    await db.user.update({
      where: { id: userId },
      data: {
        bannerBlob: buffer,
        bannerMime: file.type,
        bannerUrl: null,
      },
    })

    return ok({ bannerHref: `/api/user/banner` })
  } catch (err) {
    return serverError(err)
  }
}

export async function DELETE() {
  const { userId, error } = await requireAuth()
  if (error) return error

  try {
    await db.user.update({
      where: { id: userId },
      data: { bannerBlob: null, bannerMime: null, bannerUrl: null },
    })
    return ok({ removed: true })
  } catch (err) {
    return serverError(err)
  }
}
