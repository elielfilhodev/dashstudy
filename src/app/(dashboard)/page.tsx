import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { DashboardOverview } from "@/components/dashboard/overview"
import { redirect } from "next/navigation"
import { levelFromXp } from "@/lib/gamification"

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userId = session.user.id

  const [subjects, tasks, agendaItems, rawGamification] = await Promise.all([
    db.subject.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    db.task.findMany({
      where: { userId },
      include: { subject: { select: { id: true, name: true } } },
      orderBy: [{ dueDate: "asc" }],
    }),
    db.agendaItem.findMany({
      where: { userId },
      include: { subject: { select: { id: true, name: true } } },
      orderBy: [{ date: "asc" }, { time: "asc" }],
    }),
    db.gamification.findUnique({
      where: { userId },
      include: { achievements: true },
    }),
  ])

  const gamification = rawGamification
    ? { ...rawGamification, levelInfo: levelFromXp(rawGamification.xp) }
    : null

  return (
    <DashboardOverview
      subjects={subjects}
      tasks={tasks}
      agendaItems={agendaItems}
      gamification={gamification}
    />
  )
}
