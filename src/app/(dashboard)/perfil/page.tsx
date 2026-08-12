import { ProfileView } from "@/components/profile/profile-view"
import { fetchFromApi, requireUser } from "@/lib/session"
import type { AcademicSummary, Gamification } from "@/types"

export default async function PerfilPage() {
  const user = await requireUser()
  const gamification = await fetchFromApi<Gamification>("/gamification")

  return (
    <ProfileView
      user={{
        name: user.name ?? "Usuário",
        email: user.email,
        image: user.image,
        username: user.username,
        displayId: user.displayId,
        bannerHref: user.bannerHref,
        academic: user.academic as AcademicSummary | null,
      }}
      gamification={gamification}
    />
  )
}
