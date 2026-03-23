import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { SettingsView } from "@/components/settings/settings-view"
import { redirect } from "next/navigation"

export const metadata = { title: "Configurações — Dash Estudos" }

export default async function ConfiguracoesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userId = session.user.id

  const userRecord = await db.user.findUnique({
    where: { id: userId },
    select: { username: true, image: true, provider: true },
  })

  return (
    <SettingsView
      user={{
        name: session.user.name ?? "Usuário",
        email: session.user.email ?? "",
        image: userRecord?.image ?? session.user.image ?? null,
        username: userRecord?.username ?? null,
        provider: userRecord?.provider ?? "email",
      }}
    />
  )
}
