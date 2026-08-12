import { SettingsView } from "@/components/settings/settings-view"
import { requireUser } from "@/lib/session"
import type { AcademicSummary } from "@/types"

export const metadata = { title: "Configurações — Dash Estudos" }

export default async function ConfiguracoesPage() {
  const user = await requireUser()

  return (
    <SettingsView
      user={{
        name: user.name ?? "Usuário",
        email: user.email,
        image: user.image,
        username: user.username,
        provider: user.provider,
        academic: user.academic as AcademicSummary | null,
      }}
    />
  )
}
