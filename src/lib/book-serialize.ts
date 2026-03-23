/** Select Prisma compartilhado: listagens sem `coverBlob`. */
export const bookListSelect = {
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
} as const

type BookListRow = {
  id: string
  title: string
  author: string | null
  isbn: string | null
  rating: number | null
  coverUrl: string | null
  coverMime: string | null
  createdAt: Date
  updatedAt: Date
  _count?: { notes: number; comments: number }
}

export function serializeBookListItem(book: BookListRow, opts?: { hideNotesCount?: boolean }) {
  const hasUploadedCover = book.coverMime != null
  const hideNotes = opts?.hideNotesCount ?? false
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    isbn: book.isbn,
    rating: book.rating,
    coverUrl: book.coverUrl,
    hasCover: Boolean(book.coverUrl?.trim()) || hasUploadedCover,
    coverImageHref: hasUploadedCover
      ? `/api/books/${book.id}/cover`
      : book.coverUrl?.trim() || null,
    notesCount: hideNotes ? 0 : (book._count?.notes ?? 0),
    commentsCount: book._count?.comments ?? 0,
    createdAt: book.createdAt.toISOString(),
    updatedAt: book.updatedAt.toISOString(),
  }
}

export function isValidHttpCoverUrl(url: string | null | undefined): boolean {
  if (url == null || url.trim() === "") return true
  return /^https?:\/\//i.test(url.trim())
}
