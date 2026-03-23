import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { LibraryView } from "@/components/library/library-view"
import { bookListSelect, serializeBookListItem } from "@/lib/book-serialize"
import { redirect } from "next/navigation"

export default async function LivrariaPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const rows = await db.book.findMany({
    where: { userId: session.user.id },
    select: bookListSelect,
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  })
  const initialBooks = rows.map((b) => serializeBookListItem(b))

  return <LibraryView initialBooks={initialBooks} />
}
