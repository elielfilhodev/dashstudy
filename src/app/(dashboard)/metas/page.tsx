import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { GoalsView } from "@/components/goals/goals-view"
import { redirect } from "next/navigation"

export default async function MetasPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const goals = await db.goal.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  })

  return <GoalsView initialGoals={goals} />
}
