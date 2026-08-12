import { NextRequest, NextResponse } from "next/server"
import { setSessionCookies, type TokenPair } from "@/lib/auth-cookies"
import { ApiError, apiPostPublic } from "@/lib/backend"

/** Troca e-mail/senha por tokens na API e guarda a sessão em cookies httpOnly. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const tokens = await apiPostPublic<TokenPair>("/auth/login", body)
    await setSessionCookies(tokens)
    return NextResponse.json({ data: { ok: true } })
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "Erro ao entrar" }, { status: 500 })
  }
}
