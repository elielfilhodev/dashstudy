import { cookies } from "next/headers"

export const ACCESS_COOKIE = "ds_access"
export const REFRESH_COOKIE = "ds_refresh"

const REFRESH_MAX_AGE = 7 * 24 * 60 * 60

export type TokenPair = {
  access_token: string
  refresh_token: string
  expires_in: number
}

function baseOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
  }
}

/** Grava o par de tokens em cookies httpOnly — o JWT nunca chega ao JavaScript do cliente. */
export async function setSessionCookies(tokens: TokenPair) {
  const store = await cookies()
  store.set(ACCESS_COOKIE, tokens.access_token, {
    ...baseOptions(),
    maxAge: tokens.expires_in,
  })
  store.set(REFRESH_COOKIE, tokens.refresh_token, {
    ...baseOptions(),
    maxAge: REFRESH_MAX_AGE,
  })
}

export async function clearSessionCookies() {
  const store = await cookies()
  store.delete(ACCESS_COOKIE)
  store.delete(REFRESH_COOKIE)
}

export async function readAccessToken(): Promise<string | null> {
  return (await cookies()).get(ACCESS_COOKIE)?.value ?? null
}

export async function readRefreshToken(): Promise<string | null> {
  return (await cookies()).get(REFRESH_COOKIE)?.value ?? null
}
