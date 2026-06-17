import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/session"
import { forbidden, notFound, serverError } from "@/lib/api-response"

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

    if (!friendship) return forbidden()

    const user = await db.user.findUnique({
      where: { id: friendId },
      select: { bannerBlob: true, bannerMime: true },
    })

    if (!user) return notFound("Utilizador")
    if (!user.bannerBlob || !user.bannerMime) return new NextResponse(null, { status: 204 })

    return new NextResponse(new Uint8Array(user.bannerBlob), {
      headers: {
        "Content-Type": user.bannerMime,
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch (err) {
    return serverError(err)
  }
}
