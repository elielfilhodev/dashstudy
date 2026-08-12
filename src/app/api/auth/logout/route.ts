import { NextResponse } from "next/server"
import { clearSessionCookies, readAccessToken } from "@/lib/auth-cookies"
import { apiFetch } from "@/lib/backend"

/** Revoga os refresh tokens no servidor e apaga os cookies locais. */
export async function POST() {
  const token = await readAccessToken()

  if (token) {
    // Falha aqui não deve impedir o logout local.
    await apiFetch("/auth/logout", token, { method: "POST" }).catch(() => null)
  }

  await clearSessionCookies()
  return NextResponse.json({ data: { ok: true } })
}
