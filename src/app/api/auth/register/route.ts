import { NextRequest, NextResponse } from "next/server"
import { setSessionCookies, type TokenPair } from "@/lib/auth-cookies"
import { ApiError, apiPostPublic } from "@/lib/backend"

/** Registra e já autentica, evitando um segundo round-trip do cliente. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const user = await apiPostPublic<{ id: string }>("/auth/register", body)

    const tokens = await apiPostPublic<TokenPair>("/auth/login", {
      email: body.email,
      password: body.password,
    })
    await setSessionCookies(tokens)

    return NextResponse.json({ data: user }, { status: 201 })
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "Erro ao criar a conta" }, { status: 500 })
  }
}
