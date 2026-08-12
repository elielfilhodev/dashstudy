import { LibraryView } from "@/components/library/library-view"
import { fetchFromApi } from "@/lib/session"
import type { BookListItem } from "@/types"

export default async function LivrariaPage() {
  const initialBooks = await fetchFromApi<BookListItem[]>("/books")
  return <LibraryView initialBooks={initialBooks} />
}
