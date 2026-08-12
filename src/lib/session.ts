import "server-only"
import { redirect } from "next/navigation"
import { readAccessToken } from "@/lib/auth-cookies"
import { apiFetch, unwrap } from "@/lib/backend"

export type SessionUser = {
  id: string
  name: string | null
  email: string
  username: string | null
  displayId: string
  image: string | null
  provider: string
  githubUsername: string | null
  bannerUrl: string | null
  bannerHref: string | null
  createdAt: string
  academic: {
    academicLevel: string
    levelLabel: string
    courseName: string
    courseSlug: string
    crestIcon: string
    crestColor: string
    crestBackground: string
    startDate: string
    currentSemester: number
  } | null
}

/** Usuário autenticado, ou null. Não redireciona. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = await readAccessToken()
  if (!token) return null

  try {
    const res = await apiFetch("/user", token)
    if (!res.ok) return null
    return await unwrap<SessionUser>(res)
  } catch {
    return null
  }
}

/** Usuário autenticado ou redirect para /login — usar no topo de páginas protegidas. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  return user
}

/**
 * Busca um recurso da API já autenticado, para uso em Server Components.
 * Sessão inválida leva para /login em vez de estourar a página.
 */
export async function fetchFromApi<T>(path: string): Promise<T> {
  const token = await readAccessToken()
  if (!token) redirect("/login")

  const res = await apiFetch(path, token)
  if (res.status === 401) redirect("/login")

  return unwrap<T>(res)
}
