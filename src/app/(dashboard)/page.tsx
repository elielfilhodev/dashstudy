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
    db.subject.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        progress: true,
        workload: true,
        color: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    db.task.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        details: true,
        done: true,
        dueDate: true,
        scheduledTime: true,
        subjectId: true,
        createdAt: true,
        updatedAt: true,
        subject: { select: { id: true, name: true } },
      },
      orderBy: [{ dueDate: "asc" }],
    }),
    db.agendaItem.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        date: true,
        time: true,
        done: true,
        location: true,
        subjectId: true,
        createdAt: true,
        updatedAt: true,
        subject: { select: { id: true, name: true } },
      },
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
