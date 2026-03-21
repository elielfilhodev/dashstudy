import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { TasksView } from "@/components/tasks/tasks-view"
import { redirect } from "next/navigation"

export default async function AtividadesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userId = session.user.id

  const [tasks, subjects] = await Promise.all([
    db.task.findMany({
      where: { userId },
      include: { subject: { select: { id: true, name: true } } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    }),
    db.subject.findMany({
      where: { userId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  return <TasksView initialTasks={tasks} subjects={subjects} />
}
