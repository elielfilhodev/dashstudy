import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { SubjectsView } from "@/components/subjects/subjects-view"
import { redirect } from "next/navigation"

export default async function MateriasPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const subjects = await db.subject.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  })

  return <SubjectsView initialSubjects={subjects} />
}
