import { db } from "@/lib/db"

export type BookAccess = "owner" | "friend"

/**
 * Dono do livro ou amigo com amizade ACEITA.
 */
export async function getBookAccess(
  bookId: string,
  viewerId: string
): Promise<{ access: BookAccess; ownerId: string } | null> {
  const book = await db.book.findUnique({
    where: { id: bookId },
    select: { userId: true },
  })
  if (!book) return null
  if (book.userId === viewerId) {
    return { access: "owner", ownerId: book.userId }
  }
  const friendship = await db.friendship.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { senderId: viewerId, receiverId: book.userId },
        { senderId: book.userId, receiverId: viewerId },
      ],
    },
  })
  if (!friendship) return null
  return { access: "friend", ownerId: book.userId }
}

export async function assertAcceptedFriendship(a: string, b: string): Promise<boolean> {
  if (a === b) return true
  const f = await db.friendship.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { senderId: a, receiverId: b },
        { senderId: b, receiverId: a },
      ],
    },
  })
  return Boolean(f)
}
