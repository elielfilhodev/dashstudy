import { DashboardOverview } from "@/components/dashboard/overview"
import { fetchFromApi } from "@/lib/session"
import type { AgendaItem, Gamification, LevelInfo, Subject, Task } from "@/types"

export default async function DashboardPage() {
  const [subjects, tasks, agendaItems, gamification] = await Promise.all([
    fetchFromApi<Subject[]>("/subjects"),
    fetchFromApi<Task[]>("/tasks"),
    fetchFromApi<AgendaItem[]>("/agenda"),
    fetchFromApi<Gamification & { levelInfo: LevelInfo }>("/gamification"),
  ])

  return (
    <DashboardOverview
      subjects={subjects}
      tasks={[...tasks].sort((a, b) => a.dueDate.localeCompare(b.dueDate))}
      agendaItems={agendaItems}
      gamification={gamification}
    />
  )
}
