import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { ProfileView } from "@/components/profile/profile-view"
import { redirect } from "next/navigation"

export default async function PerfilPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userId = session.user.id

  const [gamification, userRecord] = await Promise.all([
    db.gamification.findUnique({
      where: { userId },
      include: { achievements: { orderBy: { unlockedAt: "desc" } } },
    }),
    db.user.findUnique({
      where: { id: userId },
      select: { username: true, displayId: true },
    }),
  ])

  return (
    <ProfileView
      user={{
        name: session.user.name ?? "Usuário",
        email: session.user.email ?? "",
        image: session.user.image ?? null,
        username: userRecord?.username ?? null,
        displayId: userRecord?.displayId ?? userId.slice(0, 6).toUpperCase(),
      }}
      gamification={gamification}
    />
  )
}
