import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { AgendaView } from "@/components/agenda/agenda-view"
import { redirect } from "next/navigation"

export default async function AgendaPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userId = session.user.id

  const [items, subjects] = await Promise.all([
    db.agendaItem.findMany({
      where: { userId },
      include: { subject: { select: { id: true, name: true } } },
      orderBy: [{ date: "asc" }, { time: "asc" }],
    }),
    db.subject.findMany({
      where: { userId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  return <AgendaView initialItems={items} subjects={subjects} />
}
