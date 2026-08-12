import { TasksView } from "@/components/tasks/tasks-view"
import { fetchFromApi } from "@/lib/session"
import type { Subject, Task } from "@/types"

export default async function AtividadesPage() {
  const [tasks, subjects] = await Promise.all([
    fetchFromApi<Task[]>("/tasks"),
    fetchFromApi<Subject[]>("/subjects"),
  ])

  return (
    <TasksView
      initialTasks={[...tasks].sort((a, b) => a.dueDate.localeCompare(b.dueDate))}
      subjects={subjects
        .map((s) => ({ id: s.id, name: s.name }))
        .sort((a, b) => a.name.localeCompare(b.name))}
    />
  )
}
