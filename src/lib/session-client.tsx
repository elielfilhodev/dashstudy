"use client"

import useSWR from "swr"

export type ClientSessionUser = {
  id: string
  name: string | null
  email: string
  username: string | null
  displayId: string
  image: string | null
  provider: string
  bannerHref: string | null
}

type SessionState = {
  data: { user: ClientSessionUser } | null
  status: "loading" | "authenticated" | "unauthenticated"
  update: () => Promise<unknown>
}

/**
 * Sessão derivada de `GET /api/user`, que o proxy resolve com o cookie httpOnly.
 * Mesma superfície do `useSession` do next-auth para não mexer nos componentes.
 */
export function useSession(): SessionState {
  const { data, error, isLoading, mutate } = useSWR<ClientSessionUser>("/api/user", {
    shouldRetryOnError: false,
    revalidateOnFocus: false,
  })

  const status = isLoading
    ? "loading"
    : data && !error
      ? "authenticated"
      : "unauthenticated"

  return {
    data: data && !error ? { user: data } : null,
    status,
    update: () => mutate(),
  }
}

export async function signIn(
  provider: "credentials" | "github",
  options?: { email?: string; password?: string; callbackUrl?: string }
): Promise<{ ok: boolean; error?: string }> {
  if (provider === "github") {
    window.location.href = "/api/auth/github"
    return { ok: true }
  }

  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: options?.email, password: options?.password }),
  })

  if (!res.ok) {
    const json = await res.json().catch(() => null)
    return { ok: false, error: json?.error ?? "Não foi possível entrar" }
  }

  return { ok: true }
}

export async function signOut(options?: { callbackUrl?: string }): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" })
  window.location.href = options?.callbackUrl ?? "/login"
}
