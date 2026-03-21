import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { ProfileView } from "@/components/profile/profile-view"
import { redirect } from "next/navigation"

export default async function PerfilPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userId = session.user.id

  const gamification = await db.gamification.findUnique({
    where: { userId },
    include: { achievements: { orderBy: { unlockedAt: "desc" } } },
  })

  return (
    <ProfileView
      user={{
        name: session.user.name ?? "Usuário",
        email: session.user.email ?? "",
        image: session.user.image ?? null,
      }}
      gamification={gamification}
    />
  )
}
