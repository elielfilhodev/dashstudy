import { AgendaView } from "@/components/agenda/agenda-view"
import { fetchFromApi } from "@/lib/session"
import type { AgendaItem, Subject } from "@/types"

export default async function AgendaPage() {
  const [items, subjects] = await Promise.all([
    fetchFromApi<AgendaItem[]>("/agenda"),
    fetchFromApi<Subject[]>("/subjects"),
  ])

  return (
    <AgendaView
      initialItems={items}
      subjects={subjects
        .map((s) => ({ id: s.id, name: s.name }))
        .sort((a, b) => a.name.localeCompare(b.name))}
    />
  )
}
